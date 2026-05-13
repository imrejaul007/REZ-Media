import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { broadcastService } from '../services/broadcast.js';
import { liveMetricsService } from '../services/liveMetrics.js';
import { verifyToken } from '../middleware/auth.js';
import { WebSocketMessage, CampaignMetrics } from '../types/index.js';

interface CampaignSocketMessage {
  action: 'subscribe' | 'unsubscribe' | 'update' | 'get_metrics' | 'get_history';
  campaignId?: string;
  data?: Partial<CampaignMetrics>;
}

export class CampaignSocketHandler {
  private wss: WebSocketServer;

  constructor(server: import('http').Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/campaigns',
      clientTracking: false,
    });

    this.setupServer();
    this.setupAutoReconnect();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      // Extract query parameters
      const url = new URL(req.url || '/ws/campaigns', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      const campaignId = url.searchParams.get('campaignId');

      // Authenticate
      let userId: string | undefined;
      try {
        if (token) {
          const decoded = verifyToken(token);
          userId = decoded.userId;
        }
      } catch (error) {
        console.error('[CampaignSocket] Token verification failed:', error);
        ws.close(4001, 'Unauthorized');
        return;
      }

      // Register connection
      const connectionId = broadcastService.addConnection(ws, userId);

      // Auto-subscribe to campaign room if specified
      if (campaignId) {
        broadcastService.joinRoom(connectionId, `campaign:${campaignId}`);
        this.sendInitialMetrics(connectionId, campaignId);
      }

      // Setup message handler
      ws.on('message', (data: Buffer) => {
        this.handleMessage(connectionId, data.toString());
      });

      // Setup close handler
      ws.on('close', () => {
        broadcastService.removeConnection(connectionId);
      });

      // Setup error handler
      ws.on('error', (error) => {
        console.error(`[CampaignSocket] Error for connection ${connectionId}:`, error);
      });

      // Send connection confirmation
      this.sendMessage(ws, {
        event: 'connection:established',
        data: {
          connectionId,
          subscribedRooms: broadcastService.getRoomSubscriptions(connectionId),
        },
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupAutoReconnect(): void {
    // Broadcast current metrics periodically to connected clients
    setInterval(() => {
      if (this.wss.clients.size > 0) {
        // Simulate real-time metric updates
        liveMetricsService.simulateUpdates();

        const snapshot = liveMetricsService.getSnapshot();
        broadcastService.broadcast('metrics:refreshed', snapshot);
      }
    }, 5000);

    // Check for alerts periodically
    setInterval(() => {
      const alerts = liveMetricsService.getAlerts();
      if (alerts.length > 0) {
        broadcastService.broadcast('alert:triggered', { alerts });
      }
    }, 10000);
  }

  private handleMessage(connectionId: string, rawData: string): void {
    try {
      const message: CampaignSocketMessage = JSON.parse(rawData);

      switch (message.action) {
        case 'subscribe':
          if (message.campaignId) {
            this.handleSubscribe(connectionId, message.campaignId);
          }
          break;

        case 'unsubscribe':
          if (message.campaignId) {
            this.handleUnsubscribe(connectionId, message.campaignId);
          }
          break;

        case 'update':
          if (message.campaignId && message.data) {
            this.handleUpdate(connectionId, message.campaignId, message.data);
          }
          break;

        case 'get_metrics':
          if (message.campaignId) {
            this.sendInitialMetrics(connectionId, message.campaignId);
          }
          break;

        case 'get_history':
          if (message.campaignId) {
            this.sendHistory(connectionId, message.campaignId);
          }
          break;

        default:
          console.warn(`[CampaignSocket] Unknown action: ${(message as CampaignSocketMessage).action}`);
      }
    } catch (error) {
      console.error('[CampaignSocket] Error parsing message:', error);
      this.sendError(connectionId, 'Invalid message format');
    }
  }

  private handleSubscribe(connectionId: string, campaignId: string): void {
    const roomId = `campaign:${campaignId}`;
    const success = broadcastService.joinRoom(connectionId, roomId);

    if (success) {
      this.sendMessageToConnection(connectionId, {
        event: 'campaign:updated',
        data: {
          action: 'subscribed',
          campaignId,
          roomId,
        },
        timestamp: new Date().toISOString(),
      });

      // Send current metrics immediately
      this.sendInitialMetrics(connectionId, campaignId);
    }
  }

  private handleUnsubscribe(connectionId: string, campaignId: string): void {
    const roomId = `campaign:${campaignId}`;
    broadcastService.leaveRoom(connectionId, roomId);

    this.sendMessageToConnection(connectionId, {
      event: 'campaign:updated',
      data: {
        action: 'unsubscribed',
        campaignId,
        roomId,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private handleUpdate(
    connectionId: string,
    campaignId: string,
    data: Partial<CampaignMetrics>
  ): void {
    const updated = liveMetricsService.updateMetrics(campaignId, data);

    if (updated) {
      // Broadcast to all subscribers of this campaign
      broadcastService.broadcastToRoom(`campaign:${campaignId}`, 'campaign:updated', updated);

      // Also broadcast metrics refresh
      const snapshot = liveMetricsService.getSnapshot();
      broadcastService.broadcastToRoom(`campaign:${campaignId}`, 'metrics:refreshed', snapshot);
    } else {
      this.sendError(connectionId, `Campaign ${campaignId} not found`);
    }
  }

  private sendInitialMetrics(connectionId: string, campaignId: string): void {
    const metrics = liveMetricsService.getMetrics(campaignId);

    if (metrics) {
      this.sendMessageToConnection(connectionId, {
        event: 'metrics:refreshed',
        data: { campaignId, metrics },
        timestamp: new Date().toISOString(),
      });
    } else {
      this.sendError(connectionId, `Campaign ${campaignId} not found`);
    }
  }

  private sendHistory(connectionId: string, campaignId: string): void {
    const history = liveMetricsService.getHistory(campaignId);

    this.sendMessageToConnection(connectionId, {
      event: 'metrics:refreshed',
      data: { campaignId, history, type: 'history' },
      timestamp: new Date().toISOString(),
    });
  }

  private sendError(connectionId: string, error: string): void {
    this.sendMessageToConnection(connectionId, {
      event: 'error',
      data: { message: error },
      timestamp: new Date().toISOString(),
    });
  }

  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendMessageToConnection(connectionId: string, message: WebSocketMessage): void {
    const rooms = broadcastService.getRoomSubscriptions(connectionId);
    if (rooms.length === 0) {
      // Connection might be managed differently
      return;
    }

    // For direct messages, we'd need to track ws instances
    // This is a simplified approach
  }

  public close(): void {
    this.wss.close();
  }

  public getConnectionCount(): number {
    return this.wss.clients.size;
  }
}
