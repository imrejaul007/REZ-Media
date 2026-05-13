import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import { broadcastService } from '../services/broadcast.js';
import { liveMetricsService } from '../services/liveMetrics.js';
import { verifyToken } from '../middleware/auth.js';
import { WebSocketMessage } from '../types/index.js';

interface AnalyticsSocketMessage {
  action: 'subscribe_analytics' | 'unsubscribe_analytics' | 'subscribe_alerts' | 'get_snapshot';
  filters?: {
    campaignIds?: string[];
    dateRange?: { start: string; end: string };
  };
}

export class AnalyticsSocketHandler {
  private wss: WebSocketServer;

  constructor(server: import('http').Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/analytics',
      clientTracking: false,
    });

    this.setupServer();
    this.setupAnalyticsBroadcast();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || '/ws/analytics', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      // Authenticate
      let userId: string | undefined;
      try {
        if (token) {
          const decoded = verifyToken(token);
          userId = decoded.userId;
        }
      } catch (error) {
        console.error('[AnalyticsSocket] Token verification failed:', error);
        ws.close(4001, 'Unauthorized');
        return;
      }

      const connectionId = broadcastService.addConnection(ws, userId);

      // Auto-subscribe to global analytics room
      broadcastService.joinRoom(connectionId, 'analytics:global');

      ws.on('message', (data: Buffer) => {
        this.handleMessage(connectionId, data.toString(), ws);
      });

      ws.on('close', () => {
        broadcastService.removeConnection(connectionId);
      });

      ws.on('error', (error) => {
        console.error(`[AnalyticsSocket] Error for connection ${connectionId}:`, error);
      });

      // Send initial snapshot
      this.sendSnapshot(ws);

      this.sendMessage(ws, {
        event: 'connection:established',
        data: {
          connectionId,
          subscribedRooms: ['analytics:global'],
        },
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupAnalyticsBroadcast(): void {
    // Broadcast comprehensive analytics snapshot every 10 seconds
    setInterval(() => {
      if (this.wss.clients.size > 0) {
        const snapshot = liveMetricsService.getSnapshot();
        const alerts = liveMetricsService.getAlerts();

        broadcastService.broadcastToRoom('analytics:global', 'metrics:refreshed', {
          ...snapshot,
          alerts,
        });
      }
    }, 10000);

    // Broadcast alerts as they occur
    setInterval(() => {
      const alerts = liveMetricsService.getAlerts();
      if (alerts.length > 0 && this.wss.clients.size > 0) {
        broadcastService.broadcastToRoom('analytics:global', 'alert:triggered', { alerts });
      }
    }, 15000);
  }

  private handleMessage(connectionId: string, rawData: string, ws: WebSocket): void {
    try {
      const message: AnalyticsSocketMessage = JSON.parse(rawData);

      switch (message.action) {
        case 'subscribe_analytics':
          this.handleSubscribeAnalytics(connectionId, message.filters);
          break;

        case 'unsubscribe_analytics':
          this.handleUnsubscribeAnalytics(connectionId);
          break;

        case 'subscribe_alerts':
          this.handleSubscribeAlerts(connectionId);
          break;

        case 'get_snapshot':
          this.sendSnapshot(ws);
          break;

        default:
          console.warn(`[AnalyticsSocket] Unknown action: ${message.action}`);
      }
    } catch (error) {
      console.error('[AnalyticsSocket] Error parsing message:', error);
      this.sendMessage(ws, {
        event: 'error',
        data: { message: 'Invalid message format' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleSubscribeAnalytics(
    connectionId: string,
    filters?: { campaignIds?: string[] }
  ): void {
    // Subscribe to specific campaigns if filters provided
    if (filters?.campaignIds) {
      for (const campaignId of filters.campaignIds) {
        broadcastService.joinRoom(connectionId, `campaign:${campaignId}`);
      }
    }

    this.sendMessageToConnection(connectionId, {
      event: 'campaign:updated',
      data: {
        action: 'analytics_subscribed',
        filters,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private handleUnsubscribeAnalytics(connectionId: string): void {
    const rooms = broadcastService.getRoomSubscriptions(connectionId);

    for (const roomId of rooms) {
      if (roomId.startsWith('campaign:')) {
        broadcastService.leaveRoom(connectionId, roomId);
      }
    }

    this.sendMessageToConnection(connectionId, {
      event: 'campaign:updated',
      data: {
        action: 'analytics_unsubscribed',
      },
      timestamp: new Date().toISOString(),
    });
  }

  private handleSubscribeAlerts(connectionId: string): void {
    broadcastService.joinRoom(connectionId, 'alerts:all');

    // Send current alerts immediately
    const alerts = liveMetricsService.getAlerts();
    this.sendMessageToConnection(connectionId, {
      event: 'alert:triggered',
      data: { alerts, initial: true },
      timestamp: new Date().toISOString(),
    });
  }

  private sendSnapshot(ws: WebSocket): void {
    const snapshot = liveMetricsService.getSnapshot();
    const alerts = liveMetricsService.getAlerts();

    this.sendMessage(ws, {
      event: 'metrics:refreshed',
      data: {
        ...snapshot,
        alerts,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendMessageToConnection(connectionId: string, message: WebSocketMessage): void {
    // This would require keeping track of ws instances per connection
    // For now, broadcast to the global room
    broadcastService.broadcast('campaign:updated', message.data);
  }

  public close(): void {
    this.wss.close();
  }

  public getConnectionCount(): number {
    return this.wss.clients.size;
  }
}
