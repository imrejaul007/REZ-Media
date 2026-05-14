// REZ Live Chat Widget - Main widget class

import { render, h } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type {
  ChatConfig,
  ChatMessage,
  Agent,
  ChatSession,
  FileUpload,
  QuickReplyOption,
  WidgetState,
  WidgetEvent,
  WidgetEventHandler,
  WebSocketMessage,
} from './types';
import { DEFAULT_CONFIG } from './types';
import { ChatAPI, createChatAPI } from './services/api';
import { ChatBubble } from './components/ChatBubble';
import { ChatWindow } from './components/ChatWindow';

export interface ReZLiveChatWidget {
  open(): void;
  close(): void;
  toggle(): void;
  sendMessage(content: string): Promise<void>;
  endSession(): Promise<void>;
  on(event: WidgetEvent['type'], handler: WidgetEventHandler): void;
  off(event: WidgetEvent['type'], handler: WidgetEventHandler): void;
  destroy(): void;
  getState(): WidgetState;
}

interface WidgetContainerProps {
  config: Required<ChatConfig>;
  api: ChatAPI;
  onReady?: () => void;
}

// Widget container component with all state management
function WidgetContainer({ config, api, onReady }: WidgetContainerProps) {
  // Core state
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Refs
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Event handlers
  const eventHandlersRef = useRef<Map<string, Set<WidgetEventHandler>>>(new Map());

  const emit = useCallback((event: WidgetEvent) => {
    eventHandlersRef.current.get(event.type)?.forEach((handler) => handler(event));
  }, []);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (!config.websocketUrl || !session?.id) return;

    try {
      const ws = new WebSocket(config.websocketUrl);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        emit({ type: 'connection_change', data: { connected: true }, timestamp: new Date() });

        // Send join message
        ws.send(JSON.stringify({
          type: 'join',
          sessionId: session.id,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        emit({ type: 'connection_change', data: { connected: false }, timestamp: new Date() });

        // Attempt reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      websocketRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [config.websocketUrl, session?.id, emit]);

  const handleWebSocketMessage = useCallback((data: WebSocketMessage) => {
    switch (data.type) {
      case 'message': {
        const message = data.payload as ChatMessage;
        setMessages((prev) => [...prev, message]);

        // Update unread count if window is not open
        if (!isOpen) {
          setUnreadCount((prev) => prev + 1);
        }

        emit({ type: 'message_received', data: message, timestamp: new Date() });

        // Mark as read if we have an active session
        if (isOpen && message.sender !== 'user') {
          api.markAsRead([message.id]);
        }
        break;
      }

      case 'typing_start': {
        const { agentId, agentName } = data.payload as { agentId: string; agentName: string };
        setTypingUsers((prev) => [...prev, agentName]);
        setIsAgentTyping(true);
        emit({ type: 'typing_start', data: { agentId, agentName }, timestamp: new Date() });
        break;
      }

      case 'typing_stop': {
        const { agentName } = data.payload as { agentName: string };
        setTypingUsers((prev) => prev.filter((name) => name !== agentName));
        if (typingUsers.length <= 1) {
          setIsAgentTyping(false);
        }
        emit({ type: 'typing_stop', data: { agentName }, timestamp: new Date() });
        break;
      }

      case 'agent_joined': {
        const joinedAgent = data.payload as Agent;
        setAgent(joinedAgent);
        setSession((prev) => prev ? { ...prev, status: 'active', assignedAgent: joinedAgent } : null);
        emit({ type: 'agent_joined', data: joinedAgent, timestamp: new Date() });

        // Add system message
        setMessages((prev) => [...prev, {
          id: api.generateId(),
          content: `${joinedAgent.name} has joined the chat`,
          type: 'text',
          sender: 'system',
          timestamp: new Date(),
          status: 'delivered',
        }]);
        break;
      }

      case 'agent_left': {
        const leftAgent = data.payload as Agent;
        emit({ type: 'agent_left', data: leftAgent, timestamp: new Date() });

        // Add system message
        setMessages((prev) => [...prev, {
          id: api.generateId(),
          content: `${leftAgent.name} has left the chat`,
          type: 'text',
          sender: 'system',
          timestamp: new Date(),
          status: 'delivered',
        }]);

        setAgent(null);
        break;
      }

      case 'session_ended': {
        setSession((prev) => prev ? { ...prev, status: 'ended' } : null);
        setAgent(null);
        setTypingUsers([]);

        // Add system message
        setMessages((prev) => [...prev, {
          id: api.generateId(),
          content: 'This chat session has ended',
          type: 'text',
          sender: 'system',
          timestamp: new Date(),
          status: 'delivered',
        }]);
        break;
      }

      case 'quick_replies': {
        const { options } = data.payload as { options: QuickReplyOption[] };
        // Add quick replies to the last message
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const lastMessage = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...lastMessage, quickReplyOptions: options }];
        });
        break;
      }

      case 'pong':
        // Heartbeat response, connection is alive
        break;
    }
  }, [api, emit, isOpen, typingUsers.length]);

  // Initialize widget
  useEffect(() => {
    const initWidget = async () => {
      setIsLoading(true);
      try {
        // Start a new session
        const sessionData = await api.startSession();

        // Check online status
        const status = await api.checkOnlineStatus();

        // Add welcome message
        if (sessionData.welcomeMessage) {
          setMessages([{
            id: api.generateId(),
            content: sessionData.welcomeMessage,
            type: 'text',
            sender: 'agent',
            timestamp: new Date(),
            status: 'delivered',
          }]);
        }

        setSession({
          id: sessionData.sessionId,
          status: 'waiting',
          unreadCount: 0,
        });

        // If agent is online and assigned immediately
        if (status.agentCount > 0) {
          const currentAgent = await api.getAgentStatus();
          if (currentAgent) {
            setAgent(currentAgent);
            setSession((prev) => prev ? { ...prev, status: 'active', assignedAgent: currentAgent } : null);
          }
        }

        // Load existing messages
        const existingMessages = await api.getMessages();
        if (existingMessages.length > 0) {
          setMessages(existingMessages);
        }

        setIsConnected(true);
        onReady?.();
        emit({ type: 'ready', timestamp: new Date() });

        // Connect WebSocket
        connectWebSocket();
      } catch (error) {
        console.error('Failed to initialize widget:', error);
        // Add offline message
        if (config.showDuringOffline) {
          setMessages([{
            id: api.generateId(),
            content: config.offlineMessage,
            type: 'text',
            sender: 'system',
            timestamp: new Date(),
            status: 'delivered',
          }]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initWidget();

    // Cleanup
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Heartbeat
  useEffect(() => {
    if (!isConnected || !websocketRef.current) return;

    const heartbeat = setInterval(() => {
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(heartbeat);
  }, [isConnected]);

  // Handlers
  const handleToggle = useCallback(() => {
    if (isOpen) {
      setIsMinimized(true);
    } else {
      setIsOpen(true);
      setIsMinimized(false);
      setUnreadCount(0);
    }
    emit({ type: isOpen ? 'close' : 'open', timestamp: new Date() });
  }, [isOpen, emit]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    emit({ type: 'close', timestamp: new Date() });
  }, [emit]);

  const handleMinimize = useCallback(() => {
    setIsMinimized(!isMinimized);
    emit({ type: 'minimize', data: { isMinimized: !isMinimized }, timestamp: new Date() });
  }, [isMinimized, emit]);

  const handleSendMessage = useCallback(async (content: string, files: File[]) => {
    const tempId = api.generateId();

    // Add optimistic message
    const tempMessage: ChatMessage = {
      id: tempId,
      content,
      type: files.length > 0 ? 'file' : 'text',
      sender: 'user',
      timestamp: new Date(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      // Upload files first if any
      let attachments;
      if (files.length > 0) {
        for (const file of files) {
          const upload = await api.uploadFile(file, (progress) => {
            setFileUploads((prev) =>
              prev.map((u) => u.id === tempId ? { ...u, progress } : u)
            );
          });
          attachments = upload.attachment;
        }
      }

      // Send message
      const sentMessage = await api.sendMessage({
        content,
        type: files.length > 0 ? 'file' : 'text',
        attachments: files,
      });

      // Update message status
      setMessages((prev) =>
        prev.map((m) => m.id === tempId ? { ...sentMessage, attachments } : m)
      );

      emit({ type: 'message_sent', data: sentMessage, timestamp: new Date() });
    } catch (error) {
      console.error('Failed to send message:', error);
      // Mark message as failed
      setMessages((prev) =>
        prev.map((m) => m.id === tempId ? { ...m, status: 'error' as const } : m)
      );
    }

    // Clear file uploads
    setFileUploads([]);
  }, [api, emit]);

  const handleTyping = useCallback((isTyping: boolean) => {
    setIsUserTyping(isTyping);
    api.sendTypingIndicator(isTyping);
  }, [api]);

  const handleFileSelect = useCallback((files: File[]) => {
    const newUploads: FileUpload[] = files.map((file) => ({
      id: api.generateId(),
      file,
      progress: 0,
      status: 'pending' as const,
    }));
    setFileUploads((prev) => [...prev, ...newUploads]);
    emit({ type: 'file_upload_start', data: { files }, timestamp: new Date() });
  }, [api, emit]);

  const handleFileRemove = useCallback((uploadId: string) => {
    setFileUploads((prev) => prev.filter((u) => u.id !== uploadId));
  }, []);

  const handleQuickReply = useCallback((option: QuickReplyOption) => {
    handleSendMessage(option.text, []);
    if (option.payload) {
      api.sendMessage({
        content: option.text,
        type: 'quick_reply_response',
        quickReplyPayload: option.payload,
      });
    }
  }, [handleSendMessage, api]);

  const handleRetryMessage = useCallback(async (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (message && message.status === 'error') {
      setMessages((prev) =>
        prev.map((m) => m.id === messageId ? { ...m, status: 'sending' as const } : m)
      );
      try {
        const sentMessage = await api.sendMessage({
          content: message.content,
          type: message.type,
        });
        setMessages((prev) =>
          prev.map((m) => m.id === messageId ? sentMessage : m)
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) => m.id === messageId ? { ...m, status: 'error' as const } : m)
        );
      }
    }
  }, [messages, api]);

  const handleEndSession = useCallback(async () => {
    try {
      await api.endSession();
      setSession((prev) => prev ? { ...prev, status: 'ended' } : null);
      setAgent(null);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, [api]);

  const handleImageClick = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  // Get agent status
  const agentStatus = agent?.status || (session?.status === 'waiting' ? 'away' : 'offline');

  return (
    <div
      style={{
        fontFamily: config.fontFamily,
        position: 'fixed',
        bottom: 0,
        right: 0,
        left: 0,
        top: 0,
        pointerEvents: 'none',
        zIndex: 2147483645,
      }}
    >
      <ChatWindow
        config={config}
        isOpen={isOpen}
        isMinimized={isMinimized}
        messages={messages}
        agent={agent}
        session={session}
        typingUsers={typingUsers}
        fileUploads={fileUploads}
        isConnected={isConnected}
        onClose={handleClose}
        onMinimize={handleMinimize}
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        onFileSelect={handleFileSelect}
        onFileRemove={handleFileRemove}
        onQuickReply={handleQuickReply}
        onRetryMessage={handleRetryMessage}
        onImageClick={handleImageClick}
        onEndSession={handleEndSession}
      />
      <ChatBubble
        config={config}
        isOpen={isOpen}
        unreadCount={unreadCount}
        agentStatus={agentStatus}
        onToggle={handleToggle}
      />
    </div>
  );
}

// Main widget factory function
export function createWidget(containerId: string, config: ChatConfig): ReZLiveChatWidget {
  // Merge config with defaults
  const mergedConfig = { ...DEFAULT_CONFIG, ...config } as Required<ChatConfig>;

  // Create API instance
  const api = createChatAPI(mergedConfig);

  // Get or create container
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.cssText = 'position:fixed;bottom:0;right:0;left:0;top:0;pointer-events:none;z-index:2147483645;';
    document.body.appendChild(container);
  }

  // State ref for external access
  const stateRef: { current: WidgetState } = {
    current: {
      isOpen: false,
      isMinimized: false,
      isLoading: true,
      messages: [],
      session: null,
      agent: null,
      isAgentTyping: false,
      isUserTyping: false,
      isConnected: false,
      unreadCount: 0,
      fileUploads: [],
      quickReplies: [],
      typingUsers: [],
    },
  };

  // Event handlers storage
  const eventHandlers = new Map<string, Set<WidgetEventHandler>>();

  // Mount widget
  let root: { vnode: preact.ComponentChild } | null = null;

  const mount = (onReady?: () => void) => {
    const Component = () => {
      const [state, setState] = useState<WidgetState>(stateRef.current);

      // Sync state to ref
      useEffect(() => {
        stateRef.current = state;
      }, [state]);

      // Handle events
      useEffect(() => {
        const handleEvent = (event: WidgetEvent) => {
          eventHandlers.get(event.type)?.forEach((handler) => handler(event));
        };

        api.on('message_sent', handleEvent);
        api.on('message_received', handleEvent);
        api.on('session_started', handleEvent);
        api.on('agent_joined', handleEvent);
        api.on('agent_left', handleEvent);

        return () => {
          api.off('message_sent', handleEvent);
          api.off('message_received', handleEvent);
          api.off('session_started', handleEvent);
          api.off('agent_joined', handleEvent);
          api.off('agent_left', handleEvent);
        };
      }, []);

      return (
        <WidgetContainer
          config={mergedConfig}
          api={api}
          onReady={onReady}
        />
      );
    };

    root = render(h(Component, null), container!);
  };

  mount(() => {
    // Ready callback
  });

  // Return widget API
  return {
    open: () => {
      // This would need to trigger a state update - simplified for now
      console.log('Widget open requested');
    },
    close: () => {
      console.log('Widget close requested');
    },
    toggle: () => {
      console.log('Widget toggle requested');
    },
    sendMessage: async (content: string) => {
      await api.sendMessage({ content, type: 'text' });
    },
    endSession: async () => {
      await api.endSession();
    },
    on: (event: WidgetEvent['type'], handler: WidgetEventHandler) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
    },
    off: (event: WidgetEvent['type'], handler: WidgetEventHandler) => {
      eventHandlers.get(event)?.delete(handler);
    },
    destroy: () => {
      if (container) {
        render(null, container);
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }
      api.destroy();
      eventHandlers.clear();
    },
    getState: () => stateRef.current,
  };
}

// Auto-initialize if data attributes are present
export function initFromDOM() {
  const widgetContainer = document.querySelector('[data-rez-chat]') as HTMLElement;
  if (widgetContainer) {
    const configAttr = widgetContainer.dataset.rezChatConfig;
    let config: ChatConfig = {};

    if (configAttr) {
      try {
        config = JSON.parse(configAttr);
      } catch {
        console.error('Failed to parse data-rez-chat-config');
      }
    }

    return createWidget('rez-chat-widget', config);
  }
  return null;
}

// Default export
export default createWidget;

// Re-export types for consumers
export * from './types';
