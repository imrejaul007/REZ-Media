'use client';

import React, { useState, useRef, useEffect } from 'react';

// Types
interface Message {
  id: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  timestamp: Date;
  attachments?: { type: string; url: string }[];
}

interface ChatWidgetProps {
  campaignId?: string;
  qrId?: string;
  userId?: string;
  defaultOpen?: boolean;
  position?: 'bottom-right' | 'bottom-left';
}

interface PreChatFormData {
  name: string;
  email: string;
  phone: string;
  queryType: 'general' | 'support' | 'feedback' | 'technical';
  message: string;
}

// Quick replies
const QUICK_REPLIES = [
  { id: 'reward', label: 'How do I claim my reward?', response: 'After scanning a QR code, rewards are automatically credited to your wallet. You can view your rewards in the Rewards section.' },
  { id: 'balance', label: 'Check my coin balance', response: 'I can help you check your balance. Please log in to see your current coin balance in the wallet section.' },
  { id: 'expiry', label: 'When do rewards expire?', response: 'Most rewards expire within 30-90 days. Check the reward details for specific expiry information.' },
  { id: 'support', label: 'Talk to support', response: 'I\'ll connect you with our support team. Please describe your issue.' },
];

// Bot responses
const BOT_RESPONSES: Record<string, string> = {
  greeting: 'Hello! Welcome to Ads QR Support. How can I help you today?',
  thanks: 'You\'re welcome! Is there anything else I can help you with?',
  help: 'I can help you with:\n- Reward inquiries\n- Coin balance checks\n- Redemption issues\n- Technical support\n\nWhat would you like help with?',
  default: 'I\'m not sure I understand. Can you please rephrase your question?',
};

export default function ChatWidget({
  campaignId,
  qrId,
  userId,
  defaultOpen = false,
  position = 'bottom-right',
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showPreChat, setShowPreChat] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [preChatForm, setPreChatForm] = useState<PreChatFormData>({
    name: '',
    email: '',
    phone: '',
    queryType: 'general',
    message: '',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !showPreChat) {
      inputRef.current?.focus();
    }
  }, [isOpen, showPreChat]);

  // Initialize with greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      addBotMessage(BOT_RESPONSES.greeting);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const addBotMessage = (content: string) => {
    const message: Message = {
      id: `bot_${Date.now()}`,
      type: 'bot',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, message]);
  };

  const handlePreChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Add user info as system message
    const userInfo: Message = {
      id: `user_info_${Date.now()}`,
      type: 'system',
      content: `Contact: ${preChatForm.name} | ${preChatForm.email} | ${preChatForm.phone}`,
      timestamp: new Date(),
    };

    // Add initial message
    const initialMessage: Message = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: `[${preChatForm.queryType.toUpperCase()}] ${preChatForm.message}`,
      timestamp: new Date(),
    };

    setMessages([userInfo, initialMessage]);
    setShowPreChat(false);

    // Bot response after a delay
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addBotMessage('Thank you for reaching out! I\'ve received your message. How can I assist you further?');
      }, 1000);
    }, 500);
  };

  const handleQuickReply = (reply: typeof QUICK_REPLIES[0]) => {
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: reply.label,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Bot response
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addBotMessage(reply.response);
      }, 1000);
    }, 500);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Generate bot response
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);

        const userMessageLower = inputValue.toLowerCase();
        let response = BOT_RESPONSES.default;

        if (userMessageLower.includes('thank')) {
          response = BOT_RESPONSES.thanks;
        } else if (userMessageLower.includes('help') || userMessageLower.includes('?')) {
          response = BOT_RESPONSES.help;
        }

        addBotMessage(response);
      }, 1000);
    }, 300);
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const positionStyles = position === 'bottom-right'
    ? { right: '20px', bottom: '20px' }
    : { left: '20px', bottom: '20px' };

  return (
    <div style={{ position: 'fixed', ...positionStyles, zIndex: 9999, fontFamily: 'system-ui, sans-serif' }}>
      {/* Chat Window */}
      {isOpen && (
        <div style={{
          width: '380px',
          height: '520px',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          marginBottom: '16px',
        }}>
          {/* Header */}
          <div style={{
            backgroundColor: '#6366f1',
            color: 'white',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Ads QR Support</h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.9 }}>We typically reply within minutes</p>
            </div>
            <button
              onClick={toggleChat}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                color: 'white',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              x
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {showPreChat ? (
              <form onSubmit={handlePreChatSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ margin: 0, color: '#374151', fontSize: '14px' }}>
                  Please provide some details so we can assist you better:
                </p>

                <input
                  type="text"
                  placeholder="Your Name"
                  required
                  value={preChatForm.name}
                  onChange={e => setPreChatForm({ ...preChatForm, name: e.target.value })}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                  }}
                />

                <input
                  type="email"
                  placeholder="Email Address"
                  required
                  value={preChatForm.email}
                  onChange={e => setPreChatForm({ ...preChatForm, email: e.target.value })}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                  }}
                />

                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={preChatForm.phone}
                  onChange={e => setPreChatForm({ ...preChatForm, phone: e.target.value })}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                  }}
                />

                <select
                  value={preChatForm.queryType}
                  onChange={e => setPreChatForm({ ...preChatForm, queryType: e.target.value as PreChatFormData['queryType'] })}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                  }}
                >
                  <option value="general">General Inquiry</option>
                  <option value="support">Support Request</option>
                  <option value="feedback">Feedback</option>
                  <option value="technical">Technical Issue</option>
                </select>

                <textarea
                  placeholder="How can we help you?"
                  required
                  rows={3}
                  value={preChatForm.message}
                  onChange={e => setPreChatForm({ ...preChatForm, message: e.target.value })}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                    resize: 'none',
                  }}
                />

                <button
                  type="submit"
                  style={{
                    padding: '14px',
                    backgroundColor: '#6366f1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Start Chat
                </button>
              </form>
            ) : (
              <>
                {/* Messages */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '80%',
                          padding: '10px 14px',
                          borderRadius: msg.type === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          backgroundColor: msg.type === 'user' ? '#6366f1' : msg.type === 'system' ? '#f3f4f6' : '#e0e7ff',
                          color: msg.type === 'user' ? 'white' : '#374151',
                          fontSize: '14px',
                          lineHeight: '1.4',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isTyping && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: '16px 16px 16px 4px',
                          backgroundColor: '#e0e7ff',
                          color: '#374151',
                          fontSize: '14px',
                        }}
                      >
                        <span style={{ display: 'inline-block', animation: 'pulse 1s infinite' }}>...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </>
            )}
          </div>

          {/* Quick Replies */}
          {!showPreChat && messages.length < 3 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#6b7280' }}>Quick replies:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {QUICK_REPLIES.slice(0, 2).map(reply => (
                  <button
                    key={reply.id}
                    onClick={() => handleQuickReply(reply)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f3f4f6',
                      border: '1px solid #e5e7eb',
                      borderRadius: '16px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      color: '#374151',
                    }}
                  >
                    {reply.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          {!showPreChat && (
            <form
              onSubmit={handleSendMessage}
              style={{
                padding: '16px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                gap: '8px',
              }}
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="Type your message..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '20px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#6366f1',
                  color: 'white',
                  border: 'none',
                  cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                  opacity: inputValue.trim() ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </form>
          )}
        </div>
      )}

      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#6366f1',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {/* Unread badge */}
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '12px',
            height: '12px',
            backgroundColor: '#ef4444',
            borderRadius: '50%',
            border: '2px solid white',
          }} />
        </button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
