// Core types for REZ Live Chat Widget SDK

export interface ChatMessage {
  id: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'quick_reply_response';
  sender: 'user' | 'agent' | 'system';
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  attachments?: Attachment[];
  quickReplyOptions?: QuickReplyOption[];
  agentId?: string;
  agentName?: string;
  agentAvatar?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'document' | 'audio';
  size: number;
  mimeType: string;
  thumbnail?: string;
}

export interface QuickReplyOption {
  id: string;
  text: string;
  payload?: string;
}

export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  department?: string;
}

export interface ChatSession {
  id: string;
  status: 'waiting' | 'active' | 'ended';
  assignedAgent?: Agent;
  startedAt?: Date;
  endedAt?: Date;
  unreadCount: number;
}

export interface ChatConfig {
  // API Configuration
  apiUrl: string;
  apiKey?: string;
  websocketUrl?: string;

  // Branding
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  companyName?: string;
  companyLogo?: string;
  agentAvatar?: string;

  // Widget Settings
  position?: 'bottom-right' | 'bottom-left';
  offsetX?: number;
  offsetY?: number;
  bubbleSize?: number;

  // Behavior
  welcomeMessage?: string;
  greetingMessage?: string;
  inputPlaceholder?: string;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  typingIndicatorDelay?: number;

  // Features
  enableFileUpload?: boolean;
  enableQuickReplies?: boolean;
  enableEmoji?: boolean;
  enableTypingIndicator?: boolean;
  enableReadReceipts?: boolean;
  enableVoiceMessages?: boolean;

  // Customization
  customCss?: string;
  greetingDelay?: number;
  showDuringOffline?: boolean;
  offlineMessage?: string;
}

export interface WidgetState {
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  session: ChatSession | null;
  agent: Agent | null;
  isAgentTyping: boolean;
  isUserTyping: boolean;
  isConnected: boolean;
  unreadCount: number;
  fileUploads: FileUpload[];
  quickReplies: QuickReplyOption[];
  typingUsers: string[];
}

export interface FileUpload {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  url?: string;
  attachment?: Attachment;
}

export interface SendMessagePayload {
  content: string;
  type: 'text' | 'image' | 'file' | 'quick_reply_response';
  attachments?: File[];
  quickReplyPayload?: string;
  sessionId?: string;
}

export interface WebSocketMessage {
  type:
    | 'message'
    | 'typing_start'
    | 'typing_stop'
    | 'agent_joined'
    | 'agent_left'
    | 'session_ended'
    | 'agent_status_change'
    | 'ping'
    | 'pong';
  payload: unknown;
  timestamp: number;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface StartSessionResponse {
  sessionId: string;
  welcomeMessage: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
}

export interface UploadResponse {
  attachment: Attachment;
}

// Event types
export type WidgetEventType =
  | 'ready'
  | 'open'
  | 'close'
  | 'minimize'
  | 'message_sent'
  | 'message_received'
  | 'session_started'
  | 'agent_joined'
  | 'agent_left'
  | 'typing_start'
  | 'typing_stop'
  | 'connection_change'
  | 'file_upload_start'
  | 'file_upload_progress'
  | 'file_upload_complete'
  | 'file_upload_error';

export interface WidgetEvent {
  type: WidgetEventType;
  data?: unknown;
  timestamp: Date;
}

export type WidgetEventHandler = (event: WidgetEvent) => void;

// Default configuration
export const DEFAULT_CONFIG: Required<ChatConfig> = {
  apiUrl: '',
  apiKey: '',
  websocketUrl: '',
  primaryColor: '#6366f1',
  secondaryColor: '#4f46e5',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  companyName: 'Support',
  companyLogo: '',
  agentAvatar: '',
  position: 'bottom-right',
  offsetX: 20,
  offsetY: 20,
  bubbleSize: 60,
  welcomeMessage: 'Welcome! How can we help you today?',
  greetingMessage: '',
  inputPlaceholder: 'Type a message...',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['image/*', 'application/pdf', 'text/plain'],
  typingIndicatorDelay: 1000,
  enableFileUpload: true,
  enableQuickReplies: true,
  enableEmoji: true,
  enableTypingIndicator: true,
  enableReadReceipts: true,
  enableVoiceMessages: false,
  customCss: '',
  greetingDelay: 5000,
  showDuringOffline: true,
  offlineMessage: 'We are currently offline. Please leave a message and we will get back to you.',
};
