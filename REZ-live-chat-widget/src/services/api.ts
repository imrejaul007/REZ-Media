// API Service for REZ Live Chat Widget

import type {
  ChatConfig,
  ChatMessage,
  ChatSession,
  Agent,
  SendMessagePayload,
  APIResponse,
  StartSessionResponse,
  UploadResponse,
  WidgetEvent,
  WidgetEventHandler,
} from '../types';
import { DEFAULT_CONFIG } from '../types';

export class ChatAPI {
  private config: Required<ChatConfig>;
  private sessionId: string | null = null;
  private eventHandlers: Map<string, Set<WidgetEventHandler>> = new Map();

  constructor(config: ChatConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<ChatConfig>;
  }

  // Event system
  on(event: WidgetEvent['type'], handler: WidgetEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: WidgetEvent['type'], handler: WidgetEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: WidgetEvent): void {
    this.eventHandlers.get(event.type)?.forEach((handler) => handler(event));
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    headers['X-Widget-Version'] = '1.0.0';
    return headers;
  }

  // Session management
  async startSession(userId?: string, metadata?: Record<string, unknown>): Promise<StartSessionResponse> {
    try {
      const response = await fetch(`${this.config.apiUrl}/sessions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          userId,
          metadata,
          widgetVersion: '1.0.0',
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.statusText}`);
      }

      const result: APIResponse<StartSessionResponse> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to start session');
      }

      this.sessionId = result.data.sessionId;
      this.emit({ type: 'session_started', data: result.data, timestamp: new Date() });

      return result.data;
    } catch (error) {
      console.error('ChatAPI: Error starting session', error);
      throw error;
    }
  }

  async getSession(): Promise<ChatSession | null> {
    if (!this.sessionId) return null;

    try {
      const response = await fetch(`${this.config.apiUrl}/sessions/${this.sessionId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get session: ${response.statusText}`);
      }

      const result: APIResponse<ChatSession> = await response.json();
      return result.data || null;
    } catch (error) {
      console.error('ChatAPI: Error getting session', error);
      return null;
    }
  }

  async endSession(): Promise<void> {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.config.apiUrl}/sessions/${this.sessionId}/end`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      this.sessionId = null;
    } catch (error) {
      console.error('ChatAPI: Error ending session', error);
    }
  }

  // Messaging
  async sendMessage(payload: SendMessagePayload): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: this.generateId(),
      content: payload.content,
      type: payload.type,
      sender: 'user',
      timestamp: new Date(),
      status: 'sending',
    };

    try {
      const response = await fetch(`${this.config.apiUrl}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          ...payload,
          sessionId: this.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const result: APIResponse<ChatMessage> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to send message');
      }

      message.status = 'sent';
      this.emit({ type: 'message_sent', data: message, timestamp: new Date() });

      return result.data;
    } catch (error) {
      message.status = 'error' as ChatMessage['status'];
      console.error('ChatAPI: Error sending message', error);
      throw error;
    }
  }

  async getMessages(limit = 50, before?: string): Promise<ChatMessage[]> {
    if (!this.sessionId) return [];

    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (before) params.set('before', before);

      const response = await fetch(
        `${this.config.apiUrl}/sessions/${this.sessionId}/messages?${params}`,
        { method: 'GET', headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to get messages: ${response.statusText}`);
      }

      const result: APIResponse<ChatMessage[]> = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('ChatAPI: Error getting messages', error);
      return [];
    }
  }

  async markAsRead(messageIds: string[]): Promise<void> {
    if (!this.sessionId || messageIds.length === 0) return;

    try {
      await fetch(`${this.config.apiUrl}/sessions/${this.sessionId}/read`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ messageIds }),
      });
    } catch (error) {
      console.error('ChatAPI: Error marking messages as read', error);
    }
  }

  // Typing indicator
  async sendTypingIndicator(isTyping: boolean): Promise<void> {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.config.apiUrl}/sessions/${this.sessionId}/typing`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ isTyping }),
      });
    } catch (error) {
      console.error('ChatAPI: Error sending typing indicator', error);
    }
  }

  // File uploads
  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (this.sessionId) {
      formData.append('sessionId', this.sessionId);
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
          this.emit({
            type: 'file_upload_progress',
            data: { fileName: file.name, progress },
            timestamp: new Date(),
          });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText) as APIResponse<UploadResponse>;
            if (result.success && result.data) {
              this.emit({
                type: 'file_upload_complete',
                data: result.data,
                timestamp: new Date(),
              });
              resolve(result.data);
            } else {
              reject(new Error(result.error?.message || 'Upload failed'));
            }
          } catch {
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
        this.emit({
          type: 'file_upload_error',
          data: { fileName: file.name },
          timestamp: new Date(),
        });
      });

      xhr.open('POST', `${this.config.apiUrl}/upload`);
      if (this.config.apiKey) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.config.apiKey}`);
      }
      xhr.setRequestHeader('X-Widget-Version', '1.0.0');
      xhr.send(formData);
    });
  }

  // Agent status
  async getAgentStatus(): Promise<Agent | null> {
    if (!this.sessionId) return null;

    try {
      const response = await fetch(
        `${this.config.apiUrl}/sessions/${this.sessionId}/agent`,
        { method: 'GET', headers: this.getHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to get agent status: ${response.statusText}`);
      }

      const result: APIResponse<Agent> = await response.json();
      return result.data || null;
    } catch (error) {
      console.error('ChatAPI: Error getting agent status', error);
      return null;
    }
  }

  async checkOnlineStatus(): Promise<{ isOnline: boolean; agentCount: number }> {
    try {
      const response = await fetch(`${this.config.apiUrl}/status`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to check status: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        isOnline: result.isOnline ?? false,
        agentCount: result.agentCount ?? 0,
      };
    } catch (error) {
      console.error('ChatAPI: Error checking online status', error);
      return { isOnline: false, agentCount: 0 };
    }
  }

  // Utility methods
  generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getConfig(): Required<ChatConfig> {
    return this.config;
  }

  destroy(): void {
    this.eventHandlers.clear();
    this.sessionId = null;
  }
}

// Singleton instance management
let apiInstance: ChatAPI | null = null;

export function createChatAPI(config: ChatConfig): ChatAPI {
  if (apiInstance) {
    apiInstance.destroy();
  }
  apiInstance = new ChatAPI(config);
  return apiInstance;
}

export function getChatAPI(): ChatAPI | null {
  return apiInstance;
}
