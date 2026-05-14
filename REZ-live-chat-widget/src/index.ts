// Index file - Clean exports for the SDK

export { createWidget, initFromDOM, default } from './widget';
export type { ReZLiveChatWidget } from './widget';

// Re-export types
export type {
  ChatMessage,
  Attachment,
  QuickReplyOption,
  Agent,
  ChatSession,
  ChatConfig,
  WidgetState,
  FileUpload,
  SendMessagePayload,
  WebSocketMessage,
  APIResponse,
  StartSessionResponse,
  UploadResponse,
  WidgetEvent,
  WidgetEventType,
  WidgetEventHandler,
} from './types';

// Re-export config defaults
export { DEFAULT_CONFIG } from './types';
