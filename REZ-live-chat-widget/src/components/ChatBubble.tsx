// Chat Bubble Component - Floating button that opens the chat window

import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { ChatConfig, Agent } from '../types';

interface ChatBubbleProps {
  config: Required<ChatConfig>;
  isOpen: boolean;
  unreadCount: number;
  agentStatus: Agent['status'];
  onToggle: () => void;
}

export function ChatBubble({
  config,
  isOpen,
  unreadCount,
  agentStatus,
  onToggle,
}: ChatBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [unreadCount]);

  const getStatusColor = useCallback(() => {
    switch (agentStatus) {
      case 'online':
        return '#10b981';
      case 'away':
        return '#f59e0b';
      case 'busy':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  }, [agentStatus]);

  const getPosition = useCallback(() => {
    const isBottomRight = config.position === 'bottom-right';
    return {
      [isBottomRight ? 'right' : 'left']: config.offsetX,
      bottom: config.offsetY,
    };
  }, [config.position, config.offsetX, config.offsetY]);

  const styles: Record<string, Preact.CSSProperties> = {
    container: {
      position: 'fixed',
      zIndex: 2147483647,
      ...getPosition(),
    },
    button: {
      width: config.bubbleSize,
      height: config.bubbleSize,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`,
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: isHovered
        ? `0 8px 32px ${config.primaryColor}40`
        : `0 4px 16px ${config.primaryColor}30`,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      transform: isHovered ? 'scale(1.1)' : 'scale(1)',
      position: 'relative',
    },
    icon: {
      width: '28px',
      height: '28px',
      fill: '#ffffff',
      transition: 'transform 0.3s ease',
      transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
    },
    statusIndicator: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 14,
      height: 14,
      borderRadius: '50%',
      backgroundColor: getStatusColor(),
      border: '2px solid white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    },
    unreadBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#ef4444',
      color: '#ffffff',
      fontSize: 11,
      fontWeight: 700,
      fontFamily: config.fontFamily,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 6px',
      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
      animation: isAnimating ? 'pulse 0.5s ease' : 'none',
    },
    pulse: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      backgroundColor: config.primaryColor,
      opacity: 0,
      animation: 'ripple 2s infinite',
    },
    tooltip: {
      position: 'absolute',
      top: '50%',
      [config.position === 'bottom-right' ? 'left' : 'right']: 'calc(100% + 12px)',
      transform: 'translateY(-50%)',
      backgroundColor: '#1f2937',
      color: '#ffffff',
      padding: '8px 12px',
      borderRadius: 8,
      fontSize: 13,
      fontFamily: config.fontFamily,
      whiteSpace: 'nowrap',
      opacity: isHovered ? 1 : 0,
      pointerEvents: 'none',
      transition: 'opacity 0.2s ease',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    },
  };

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes ripple {
            0% {
              transform: scale(1);
              opacity: 0.4;
            }
            100% {
              transform: scale(1.8);
              opacity: 0;
            }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
        `}
      </style>
      <button
        style={styles.button}
        onClick={onToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        aria-expanded={isOpen}
      >
        {!isOpen && <div style={styles.pulse} />}
        <svg style={styles.icon} viewBox="0 0 24 24">
          {isOpen ? (
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          ) : (
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          )}
        </svg>
        {unreadCount > 0 && (
          <span style={styles.unreadBadge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        <div style={styles.statusIndicator} />
      </button>
      {!isOpen && (
        <div style={styles.tooltip}>
          Chat with {config.companyName}
        </div>
      )}
    </div>
  );
}

export default ChatBubble;
