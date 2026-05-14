// Message List Component - Displays chat history

import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { ChatMessage, QuickReplyOption, ChatConfig, Agent } from '../types';

interface MessageListProps {
  messages: ChatMessage[];
  config: Required<ChatConfig>;
  agent: Agent | null;
  typingUsers: string[];
  onQuickReply: (option: QuickReplyOption) => void;
  onImageClick?: (url: string) => void;
  onRetryMessage?: (messageId: string) => void;
}

interface MessageBubbleProps {
  message: ChatMessage;
  config: Required<ChatConfig>;
  agent: Agent | null;
  isGrouped: boolean;
  onImageClick?: (url: string) => void;
  onRetry?: () => void;
}

function MessageBubble({
  message,
  config,
  agent,
  isGrouped,
  onImageClick,
  onRetry,
}: MessageBubbleProps) {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';

  const styles: Record<string, Preact.CSSProperties> = {
    container: {
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      marginBottom: isGrouped ? 2 : 12,
      paddingLeft: isUser ? 48 : 0,
      paddingRight: isUser ? 0 : 48,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      backgroundColor: config.primaryColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      fontSize: 14,
      fontWeight: 600,
      fontFamily: config.fontFamily,
      flexShrink: 0,
      marginRight: isUser ? 0 : 8,
      marginLeft: isUser ? 8 : 0,
      alignSelf: 'flex-end',
      opacity: isGrouped ? 0 : 1,
    },
    content: {
      maxWidth: '75%',
      minWidth: 80,
    },
    bubble: {
      padding: '10px 14px',
      borderRadius: isUser
        ? '18px 18px 4px 18px'
        : '18px 18px 18px 4px',
      backgroundColor: isUser
        ? `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`
        : isSystem
          ? '#f3f4f6'
          : '#ffffff',
      color: isUser || isSystem ? '#ffffff' : '#1f2937',
      fontSize: 14,
      lineHeight: 1.5,
      fontFamily: config.fontFamily,
      boxShadow: isSystem ? 'none' : '0 1px 2px rgba(0,0,0,0.1)',
      wordBreak: 'break-word',
      position: 'relative',
    },
    image: {
      maxWidth: '100%',
      maxHeight: 200,
      borderRadius: 12,
      cursor: onImageClick ? 'pointer' : 'default',
      objectFit: 'cover',
    },
    fileContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: 8,
      backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : '#f3f4f6',
      borderRadius: 8,
      minWidth: 200,
    },
    fileIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: config.primaryColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileInfo: {
      flex: 1,
      overflow: 'hidden',
    },
    fileName: {
      fontSize: 13,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      color: isUser ? '#ffffff' : '#1f2937',
    },
    fileSize: {
      fontSize: 11,
      opacity: 0.7,
      color: isUser ? '#ffffff' : '#6b7280',
    },
    time: {
      fontSize: 10,
      color: '#9ca3af',
      marginTop: 4,
      fontFamily: config.fontFamily,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    status: {
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
    },
    error: {
      color: '#ef4444',
      cursor: 'pointer',
      marginLeft: 4,
    },
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderContent = () => {
    if (message.type === 'image' && message.attachments?.[0]) {
      const attachment = message.attachments[0];
      return (
        <img
          src={attachment.thumbnail || attachment.url}
          alt={attachment.name}
          style={styles.image}
          onClick={() => onImageClick?.(attachment.url)}
          loading="lazy"
        />
      );
    }

    if (message.type === 'file' && message.attachments?.[0]) {
      const attachment = message.attachments[0];
      return (
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
        >
          <div style={styles.fileContainer}>
            <div style={styles.fileIcon}>
              <svg width="20" height="20" fill="#ffffff" viewBox="0 0 24 24">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
              </svg>
            </div>
            <div style={styles.fileInfo}>
              <div style={styles.fileName}>{attachment.name}</div>
              <div style={styles.fileSize}>{formatFileSize(attachment.size)}</div>
            </div>
          </div>
        </a>
      );
    }

    return <span>{message.content}</span>;
  };

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" opacity="0.3" />
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" opacity="0.5" />
          </svg>
        );
      case 'sent':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        );
      case 'delivered':
        return (
          <svg width="14" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
          </svg>
        );
      case 'read':
        return (
          <svg width="14" height="12" viewBox="0 0 24 24" fill="#3b82f6">
            <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (isSystem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
        <div
          style={{
            backgroundColor: '#f3f4f6',
            color: '#6b7280',
            padding: '6px 16px',
            borderRadius: 16,
            fontSize: 12,
            fontFamily: config.fontFamily,
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {!isGrouped && (
        <div style={styles.avatar}>
          {isUser ? (
            'U'
          ) : (
            agent?.avatar ? (
              <img
                src={agent.avatar}
                alt={agent.name}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              getInitials(agent?.name || 'Agent')
            )
          )}
        </div>
      )}
      <div style={styles.content}>
        <div style={styles.bubble}>
          {renderContent()}
        </div>
        <div style={styles.time}>
          <span>{formatTime(message.timestamp)}</span>
          {isUser && (
            <span style={styles.status}>
              {message.status === 'error' ? (
                <span style={styles.error} onClick={onRetry} title="Click to retry">
                  Failed
                </span>
              ) : (
                getStatusIcon()
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickReplies({
  options,
  config,
  onSelect,
}: {
  options: QuickReplyOption[];
  config: Required<ChatConfig>;
  onSelect: (option: QuickReplyOption) => void;
}) {
  const styles: Record<string, Preact.CSSProperties> = {
    container: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    button: {
      padding: '8px 16px',
      borderRadius: 20,
      border: `1px solid ${config.primaryColor}`,
      backgroundColor: 'transparent',
      color: config.primaryColor,
      fontSize: 13,
      fontFamily: config.fontFamily,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
  };

  return (
    <div style={styles.container}>
      {options.map((option) => (
        <button
          key={option.id}
          style={styles.button}
          onClick={() => onSelect(option)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = config.primaryColor;
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = config.primaryColor;
          }}
        >
          {option.text}
        </button>
      ))}
    </div>
  );
}

function TypingIndicator({
  agent,
  config,
}: {
  agent: Agent | null;
  config: Required<ChatConfig>;
}) {
  const styles: Record<string, Preact.CSSProperties> = {
    container: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      paddingRight: 48,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      backgroundColor: config.primaryColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      fontSize: 14,
      fontWeight: 600,
      fontFamily: config.fontFamily,
    },
    bubble: {
      padding: '12px 16px',
      borderRadius: '18px 18px 18px 4px',
      backgroundColor: '#ffffff',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: '#9ca3af',
      animation: 'bounce 1.4s infinite ease-in-out',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.avatar}>
        {agent?.avatar ? (
          <img
            src={agent.avatar}
            alt={agent.name}
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          agent?.name?.charAt(0) || 'A'
        )}
      </div>
      <div style={styles.bubble}>
        <div style={{ ...styles.dot, animationDelay: '0s' }} />
        <div style={{ ...styles.dot, animationDelay: '0.2s' }} />
        <div style={{ ...styles.dot, animationDelay: '0.4s' }} />
      </div>
      <style>
        {`
          @keyframes bounce {
            0%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-6px); }
          }
        `}
      </style>
    </div>
  );
}

export function MessageList({
  messages,
  config,
  agent,
  typingUsers,
  onQuickReply,
  onImageClick,
  onRetryMessage,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  useEffect(() => {
    if (containerRef.current && shouldAutoScroll.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 100;
    }
  };

  const getGroupedKey = (message: ChatMessage, index: number) => {
    const prevMessage = messages[index - 1];
    if (!prevMessage) return 'first';

    const sameSender = prevMessage.sender === message.sender;
    const sameMinute =
      new Date(prevMessage.timestamp).getTime() -
        new Date(message.timestamp).getTime() <
      60000;

    return sameSender && sameMinute ? 'grouped' : 'new';
  };

  const styles: Record<string, Preact.CSSProperties> = {
    container: {
      flex: 1,
      overflow: 'auto',
      padding: 16,
      backgroundColor: '#f9fafb',
      scrollBehavior: 'smooth',
    },
    empty: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#9ca3af',
      textAlign: 'center',
      padding: 24,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      marginBottom: 16,
      opacity: 0.5,
    },
  };

  if (messages.length === 0) {
    return (
      <div ref={containerRef} style={styles.container}>
        <div style={styles.empty}>
          <svg style={styles.emptyIcon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          </svg>
          <p style={{ fontFamily: config.fontFamily, fontSize: 14 }}>
            No messages yet. Start a conversation!
          </p>
        </div>
      </div>
    );
  }

  const latestQuickReplies =
    messages.length > 0 ? messages[messages.length - 1].quickReplyOptions : [];

  return (
    <div
      ref={containerRef}
      style={styles.container}
      onScroll={handleScroll}
    >
      {messages.map((message, index) => (
        <div key={message.id}>
          <MessageBubble
            message={message}
            config={config}
            agent={agent}
            isGrouped={getGroupedKey(message, index) === 'grouped'}
            onImageClick={onImageClick}
            onRetry={() => onRetryMessage?.(message.id)}
          />
        </div>
      ))}
      {typingUsers.length > 0 && (
        <TypingIndicator agent={agent} config={config} />
      )}
      {latestQuickReplies && latestQuickReplies.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <QuickReplies
            options={latestQuickReplies}
            config={config}
            onSelect={onQuickReply}
          />
        </div>
      )}
    </div>
  );
}

export default MessageList;
