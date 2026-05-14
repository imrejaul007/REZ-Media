// Chat Window Component - Main chat interface

import { h } from 'preact';
import { useState, useCallback, useEffect } from 'preact/hooks';
import type { ChatConfig, ChatMessage, Agent, FileUpload, QuickReplyOption, ChatSession } from '../types';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

interface ChatWindowProps {
  config: Required<ChatConfig>;
  isOpen: boolean;
  isMinimized: boolean;
  messages: ChatMessage[];
  agent: Agent | null;
  session: ChatSession | null;
  typingUsers: string[];
  fileUploads: FileUpload[];
  isConnected: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onSendMessage: (content: string, files: File[]) => void;
  onTyping: (isTyping: boolean) => void;
  onFileSelect: (files: File[]) => void;
  onFileRemove: (uploadId: string) => void;
  onQuickReply: (option: QuickReplyOption) => void;
  onRetryMessage: (messageId: string) => void;
  onImageClick?: (url: string) => void;
  onEndSession?: () => void;
}

export function ChatWindow({
  config,
  isOpen,
  isMinimized,
  messages,
  agent,
  session,
  typingUsers,
  fileUploads,
  isConnected,
  onClose,
  onMinimize,
  onSendMessage,
  onTyping,
  onFileSelect,
  onFileRemove,
  onQuickReply,
  onRetryMessage,
  onImageClick,
  onEndSession,
}: ChatWindowProps) {
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const getStatusText = useCallback(() => {
    if (!isConnected) return 'Connecting...';
    if (session?.status === 'waiting') {
      return `Connecting you to support... Queue: ${session.unreadCount || 0}`;
    }
    if (agent) {
      switch (agent.status) {
        case 'online':
          return `${agent.name} is online`;
        case 'away':
          return `${agent.name} is away`;
        case 'busy':
          return `${agent.name} is busy`;
        default:
          return 'Support offline';
      }
    }
    return 'Ready to help';
  }, [isConnected, session, agent]);

  const getStatusColor = useCallback(() => {
    if (!isConnected) return '#f59e0b';
    if (session?.status === 'waiting') return '#f59e0b';
    if (agent) {
      switch (agent.status) {
        case 'online':
          return '#10b981';
        case 'away':
          return '#f59e0b';
        case 'busy':
          return '#ef4444';
        default:
          return '#6b7280';
      }
    }
    return config.showDuringOffline ? '#6b7280' : '#ef4444';
  }, [isConnected, session, agent, config.showDuringOffline]);

  const handleEndSession = useCallback(() => {
    onEndSession?.();
    setShowEndConfirm(false);
  }, [onEndSession]);

  useEffect(() => {
    if (!isOpen) {
      setShowEndConfirm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const styles: Record<string, Preact.CSSProperties> = {
    overlay: {
      position: 'fixed',
      bottom: config.offsetY + config.bubbleSize + 16,
      [config.position === 'bottom-right' ? 'right' : 'left']: config.offsetX,
      width: 380,
      maxWidth: 'calc(100vw - 40px)',
      height: isMinimized ? 56 : 560,
      maxHeight: isMinimized ? 56 : 'calc(100vh - 120px)',
      backgroundColor: '#ffffff',
      borderRadius: 16,
      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.2)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 2147483646,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      transformOrigin: config.position === 'bottom-right' ? 'bottom right' : 'bottom left',
      animation: 'slideIn 0.3s ease',
    },
    header: {
      background: `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`,
      color: '#ffffff',
      padding: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      flexShrink: 0,
    },
    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: '50%',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      border: '2px solid rgba(255, 255, 255, 0.3)',
    },
    avatarImg: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    headerInfo: {
      flex: 1,
    },
    companyName: {
      fontSize: 16,
      fontWeight: 600,
      fontFamily: config.fontFamily,
      margin: 0,
    },
    status: {
      fontSize: 12,
      opacity: 0.9,
      fontFamily: config.fontFamily,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      margin: 0,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: getStatusColor(),
      boxShadow: `0 0 8px ${getStatusColor()}`,
    },
    headerActions: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    },
    headerBtn: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      border: 'none',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      transition: 'background-color 0.2s ease',
    },
    content: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
    },
    welcomeBanner: {
      backgroundColor: `${config.primaryColor}10`,
      padding: 12,
      textAlign: 'center',
      borderBottom: `1px solid ${config.primaryColor}20`,
    },
    welcomeText: {
      fontSize: 14,
      color: '#4b5563',
      fontFamily: config.fontFamily,
      margin: 0,
    },
    confirmDialog: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      backdropFilter: 'blur(4px)',
    },
    confirmBox: {
      backgroundColor: '#ffffff',
      borderRadius: 12,
      padding: 24,
      margin: 16,
      textAlign: 'center',
      maxWidth: 280,
    },
    confirmTitle: {
      fontSize: 16,
      fontWeight: 600,
      fontFamily: config.fontFamily,
      color: '#1f2937',
      marginBottom: 8,
    },
    confirmText: {
      fontSize: 14,
      fontFamily: config.fontFamily,
      color: '#6b7280',
      marginBottom: 20,
    },
    confirmButtons: {
      display: 'flex',
      gap: 12,
      justifyContent: 'center',
    },
    confirmBtn: {
      padding: '10px 20px',
      borderRadius: 8,
      border: 'none',
      cursor: 'pointer',
      fontSize: 14,
      fontWeight: 500,
      fontFamily: config.fontFamily,
      transition: 'all 0.2s ease',
    },
    cancelBtn: {
      backgroundColor: '#f3f4f6',
      color: '#4b5563',
    },
    endBtn: {
      backgroundColor: '#ef4444',
      color: '#ffffff',
    },
  };

  const isDisabled = !isConnected || session?.status === 'ended';

  return (
    <div style={styles.overlay}>
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        `}
      </style>

      {/* Header */}
      <div style={styles.header} onClick={onMinimize}>
        <div style={styles.headerLeft}>
          <div style={styles.avatar}>
            {config.companyLogo ? (
              <img
                src={config.companyLogo}
                alt={config.companyName}
                style={styles.avatarImg}
              />
            ) : agent?.avatar ? (
              <img
                src={agent.avatar}
                alt={agent.name}
                style={styles.avatarImg}
              />
            ) : (
              <span style={{ fontSize: 18, fontWeight: 600, fontFamily: config.fontFamily }}>
                {config.companyName.charAt(0)}
              </span>
            )}
          </div>
          <div style={styles.headerInfo}>
            <h3 style={styles.companyName}>{config.companyName}</h3>
            <p style={styles.status}>
              <span style={styles.statusDot} />
              {getStatusText()}
            </p>
          </div>
        </div>
        <div style={styles.headerActions} onClick={(e) => e.stopPropagation()}>
          {session?.status === 'active' && (
            <button
              style={styles.headerBtn}
              onClick={() => setShowEndConfirm(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
              }}
              aria-label="End chat"
              title="End chat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
              </svg>
            </button>
          )}
          <button
            style={styles.headerBtn}
            onClick={onMinimize}
            aria-label="Minimize chat"
            title="Minimize"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13H5v-2h14v2z" />
            </svg>
          </button>
          <button
            style={styles.headerBtn}
            onClick={onClose}
            aria-label="Close chat"
            title="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div style={styles.content}>
          {/* Welcome message */}
          {messages.length === 0 && config.welcomeMessage && (
            <div style={styles.welcomeBanner}>
              <p style={styles.welcomeText}>{config.welcomeMessage}</p>
            </div>
          )}

          {/* Messages */}
          <MessageList
            messages={messages}
            config={config}
            agent={agent}
            typingUsers={typingUsers}
            onQuickReply={onQuickReply}
            onImageClick={onImageClick}
            onRetryMessage={onRetryMessage}
          />

          {/* Input */}
          <MessageInput
            config={config}
            fileUploads={fileUploads}
            isDisabled={isDisabled}
            onSend={onSendMessage}
            onTyping={onTyping}
            onFileSelect={onFileSelect}
            onFileRemove={onFileRemove}
          />
        </div>
      )}

      {/* End session confirmation */}
      {showEndConfirm && (
        <div style={styles.confirmDialog}>
          <div style={styles.confirmBox}>
            <h4 style={styles.confirmTitle}>End Chat?</h4>
            <p style={styles.confirmText}>
              Are you sure you want to end this chat session?
            </p>
            <div style={styles.confirmButtons}>
              <button
                style={{ ...styles.confirmBtn, ...styles.cancelBtn }}
                onClick={() => setShowEndConfirm(false)}
              >
                Cancel
              </button>
              <button
                style={{ ...styles.confirmBtn, ...styles.endBtn }}
                onClick={handleEndSession}
              >
                End Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatWindow;
