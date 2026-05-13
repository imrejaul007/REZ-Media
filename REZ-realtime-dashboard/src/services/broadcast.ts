import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketMessage, RoomSubscription, BroadcastStatus, WebSocketEvent } from '../types/index.js';

type ConnectionId = string;

interface ConnectionInfo {
  ws: WebSocket;
  rooms: Set<string>;
  userId?: string;
  connectedAt: Date;
  lastPing: Date;
}

class BroadcastService {
  private connections: Map<ConnectionId, ConnectionInfo> = new Map();
  private rooms: Map<string, Set<ConnectionId>> = new Map();
  private pingIntervals: Map<ConnectionId, NodeJS.Timeout> = new Map();
  private broadcasts: Map<string, BroadcastStatus> = new Map();

  private readonly PING_INTERVAL = parseInt(process.env.WS_PING_INTERVAL || '30000');
  private readonly PING_TIMEOUT = parseInt(process.env.WS_PING_TIMEOUT || '10000');

  constructor() {
    this.startGlobalMetricsBroadcast();
  }

  public addConnection(ws: WebSocket, userId?: string): ConnectionId {
    const connectionId = uuidv4();

    this.connections.set(connectionId, {
      ws,
      rooms: new Set(),
      userId,
      connectedAt: new Date(),
      lastPing: new Date(),
    });

    // Setup ping/pong for this connection
    this.setupPingPong(connectionId, ws);

    console.log(`[BroadcastService] New connection: ${connectionId}${userId ? ` (user: ${userId})` : ''}`);

    return connectionId;
  }

  public removeConnection(connectionId: ConnectionId): void {
    const info = this.connections.get(connectionId);
    if (!info) return;

    // Remove from all rooms
    for (const roomId of info.rooms) {
      this.leaveRoomInternal(connectionId, roomId);
    }

    // Clear ping interval
    const interval = this.pingIntervals.get(connectionId);
    if (interval) {
      clearInterval(interval);
      this.pingIntervals.delete(connectionId);
    }

    this.connections.delete(connectionId);
    console.log(`[BroadcastService] Connection removed: ${connectionId}`);
  }

  public joinRoom(connectionId: string, roomId: string): boolean {
    const info = this.connections.get(connectionId);
    if (!info) {
      console.warn(`[BroadcastService] Cannot join room: connection ${connectionId} not found`);
      return false;
    }

    if (info.rooms.has(roomId)) {
      return true; // Already in room
    }

    // Add to room's connection set
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(connectionId);

    // Add room to connection's rooms
    info.rooms.add(roomId);

    console.log(`[BroadcastService] Connection ${connectionId} joined room: ${roomId}`);
    console.log(`[BroadcastService] Room ${roomId} now has ${this.rooms.get(roomId)!.size} connections`);

    return true;
  }

  public leaveRoom(connectionId: string, roomId: string): boolean {
    const info = this.connections.get(connectionId);
    if (!info) {
      return false;
    }

    this.leaveRoomInternal(connectionId, roomId);
    info.rooms.delete(roomId);

    return true;
  }

  private leaveRoomInternal(connectionId: string, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(connectionId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
        console.log(`[BroadcastService] Room ${roomId} is now empty and removed`);
      }
    }
  }

  public broadcast(event: WebSocketEvent, data: unknown, targetRoom?: string): void {
    const message: WebSocketMessage = {
      event,
      data,
      timestamp: new Date().toISOString(),
      roomId: targetRoom,
    };

    const messageStr = JSON.stringify(message);

    if (targetRoom) {
      // Broadcast to specific room
      const room = this.rooms.get(targetRoom);
      if (room) {
        for (const connectionId of room) {
          this.sendToConnection(connectionId, messageStr);
        }
        console.log(`[BroadcastService] Broadcast to room ${targetRoom}: ${event} (${room.size} recipients)`);
      }
    } else {
      // Broadcast to all connected clients
      for (const [connectionId] of this.connections) {
        this.sendToConnection(connectionId, messageStr);
      }
      console.log(`[BroadcastService] Global broadcast: ${event} (${this.connections.size} recipients)`);
    }
  }

  public broadcastToRoom(roomId: string, event: WebSocketEvent, data: unknown): void {
    this.broadcast(event, data, roomId);
  }

  public async broadcastWithProgress(
    roomIds: string[],
    event: WebSocketEvent,
    dataProvider: (roomId: string) => unknown
  ): Promise<BroadcastStatus> {
    const broadcastId = uuidv4();
    const status: BroadcastStatus = {
      broadcastId,
      status: 'in_progress',
      totalRooms: roomIds.length,
      roomsCompleted: 0,
      startedAt: new Date(),
    };

    this.broadcasts.set(broadcastId, status);

    for (const roomId of roomIds) {
      const data = dataProvider(roomId);
      this.broadcast(event, data, roomId);
      status.roomsCompleted++;
      await this.delay(100); // Small delay to prevent overwhelming
    }

    status.status = 'completed';
    status.completedAt = new Date();
    this.broadcasts.set(broadcastId, status);

    return status;
  }

  public getBroadcastStatus(broadcastId: string): BroadcastStatus | null {
    return this.broadcasts.get(broadcastId) || null;
  }

  public getRoomSubscriptions(connectionId: string): string[] {
    const info = this.connections.get(connectionId);
    return info ? Array.from(info.rooms) : [];
  }

  public getConnectionCount(): number {
    return this.connections.size;
  }

  public getRoomCount(): number {
    return this.rooms.size;
  }

  public getRoomSize(roomId: string): number {
    return this.rooms.get(roomId)?.size || 0;
  }

  public getConnectionRooms(): { roomId: string; size: number }[] {
    return Array.from(this.rooms.entries()).map(([roomId, connections]) => ({
      roomId,
      size: connections.size,
    }));
  }

  private sendToConnection(connectionId: ConnectionId, message: string): void {
    const info = this.connections.get(connectionId);
    if (!info || info.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      info.ws.send(message);
    } catch (error) {
      console.error(`[BroadcastService] Error sending to ${connectionId}:`, error);
      this.removeConnection(connectionId);
    }
  }

  private setupPingPong(connectionId: ConnectionId, ws: WebSocket): void {
    const interval = setInterval(() => {
      const info = this.connections.get(connectionId);
      if (!info) {
        clearInterval(interval);
        return;
      }

      if (info.ws.readyState === WebSocket.OPEN) {
        try {
          info.ws.ping();
          info.lastPing = new Date();
        } catch (error) {
          console.error(`[BroadcastService] Ping error for ${connectionId}:`, error);
          this.removeConnection(connectionId);
          clearInterval(interval);
        }
      } else {
        this.removeConnection(connectionId);
        clearInterval(interval);
      }
    }, this.PING_INTERVAL);

    this.pingIntervals.set(connectionId, interval);

    // Handle pong
    ws.on('pong', () => {
      const info = this.connections.get(connectionId);
      if (info) {
        info.lastPing = new Date();
      }
    });
  }

  private startGlobalMetricsBroadcast(): void {
    const intervalMs = parseInt(process.env.BROADCAST_INTERVAL_MS || '5000');

    setInterval(() => {
      if (this.connections.size > 0) {
        // This will be called by liveMetricsService to push updates
        // The actual broadcast is triggered by the caller
      }
    }, intervalMs);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const broadcastService = new BroadcastService();
