// Message Input Component - Text input with file attachments and emoji

import { h } from 'preact';
import { useState, useRef, useCallback } from 'preact/hooks';
import type { ChatConfig, FileUpload } from '../types';

interface MessageInputProps {
  config: Required<ChatConfig>;
  fileUploads: FileUpload[];
  isDisabled: boolean;
  onSend: (content: string, files: File[]) => void;
  onTyping: (isTyping: boolean) => void;
  onFileSelect: (files: File[]) => void;
  onFileRemove: (uploadId: string) => void;
}

export function MessageInput({
  config,
  fileUploads,
  isDisabled,
  onSend,
  onTyping,
  onFileSelect,
  onFileRemove,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSubmit = useCallback(() => {
    const trimmedMessage = message.trim();
    const pendingFiles = fileUploads.filter((f) => f.status === 'success');
    const fileObjects = pendingFiles.map((f) => f.file);

    if (trimmedMessage || fileObjects.length > 0) {
      onSend(trimmedMessage, fileObjects);
      setMessage('');
      onTyping(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [message, fileUploads, onSend, onTyping]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleInput = useCallback(
    (e: Event) => {
      const target = e.target as HTMLTextAreaElement;
      setMessage(target.value);

      // Auto-resize textarea
      target.style.height = 'auto';
      target.style.height = `${Math.min(target.scrollHeight, 120)}px`;

      // Typing indicator
      onTyping(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, config.typingIndicatorDelay);
    },
    [onTyping, config.typingIndicatorDelay]
  );

  const handleFileChange = useCallback(
    (e: Event) => {
      const input = e.target as HTMLInputElement;
      if (input.files) {
        const files = Array.from(input.files);
        const validFiles = files.filter((file) => {
          if (file.size > config.maxFileSize) {
            alert(`File "${file.name}" is too large. Maximum size is ${config.maxFileSize / 1024 / 1024}MB`);
            return false;
          }
          return true;
        });
        onFileSelect(validFiles);
        input.value = '';
      }
      setShowFileMenu(false);
    },
    [config.maxFileSize, onFileSelect]
  );

  const handleEmojiSelect = useCallback((emoji: string) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const commonEmojis = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '💯', '🙏', '😍', '🤔'];

  const styles: Record<string, Preact.CSSProperties> = {
    container: {
      borderTop: '1px solid #e5e7eb',
      backgroundColor: '#ffffff',
      padding: 12,
    },
    filePreviews: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    filePreview: {
      position: 'relative',
      width: 64,
      height: 64,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: '#f3f4f6',
    },
    previewImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    previewFile: {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeBtn: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 20,
      height: 20,
      borderRadius: '50%',
      backgroundColor: 'rgba(0,0,0,0.6)',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      fontSize: 12,
    },
    progressBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      height: 3,
      backgroundColor: config.primaryColor,
      transition: 'width 0.2s ease',
    },
    inputWrapper: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      backgroundColor: '#f3f4f6',
      borderRadius: 24,
      padding: '4px 4px 4px 16px',
      border: isFocused ? `2px solid ${config.primaryColor}` : '2px solid transparent',
      transition: 'border-color 0.2s ease',
    },
    textarea: {
      flex: 1,
      border: 'none',
      background: 'transparent',
      resize: 'none',
      outline: 'none',
      fontSize: 14,
      fontFamily: config.fontFamily,
      color: '#1f2937',
      padding: '8px 0',
      lineHeight: 1.5,
      minHeight: 24,
      maxHeight: 120,
    },
    actions: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    },
    actionBtn: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#6b7280',
      transition: 'all 0.2s ease',
    },
    sendBtn: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      border: 'none',
      backgroundColor: message.trim() || fileUploads.some((f) => f.status === 'success')
        ? config.primaryColor
        : '#e5e7eb',
      cursor:
        message.trim() || fileUploads.some((f) => f.status === 'success')
          ? 'pointer'
          : 'default',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      transition: 'all 0.2s ease',
    },
    fileMenu: {
      position: 'absolute',
      bottom: '100%',
      left: 12,
      backgroundColor: '#ffffff',
      borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      padding: 8,
      display: 'flex',
      gap: 8,
      marginBottom: 8,
    },
    fileOption: {
      width: 56,
      height: 56,
      borderRadius: 8,
      border: '1px solid #e5e7eb',
      backgroundColor: '#ffffff',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      transition: 'all 0.2s ease',
    },
    emojiPicker: {
      position: 'absolute',
      bottom: '100%',
      left: 12,
      backgroundColor: '#ffffff',
      borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      padding: 12,
      marginBottom: 8,
    },
    emojiGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 4,
    },
    emoji: {
      width: 36,
      height: 36,
      borderRadius: 8,
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      fontSize: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background-color 0.2s ease',
    },
    disabled: {
      opacity: 0.6,
      pointerEvents: 'none',
    },
  };

  const hiddenInputStyles = { display: 'none' } as Preact.CSSProperties;

  return (
    <div style={{ ...styles.container, ...(isDisabled ? styles.disabled : {}) }}>
      {/* File previews */}
      {fileUploads.length > 0 && (
        <div style={styles.filePreviews}>
          {fileUploads.map((upload) => (
            <div key={upload.id} style={styles.filePreview}>
              {upload.file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(upload.file)}
                  alt={upload.file.name}
                  style={styles.previewImage}
                />
              ) : (
                <div style={styles.previewFile}>
                  <svg width="24" height="24" fill="#6b7280" viewBox="0 0 24 24">
                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
                  </svg>
                </div>
              )}
              {upload.status === 'uploading' && (
                <div
                  style={{
                    ...styles.progressBar,
                    width: `${upload.progress}%`,
                  }}
                />
              )}
              <button
                style={styles.removeBtn}
                onClick={() => onFileRemove(upload.id)}
                aria-label="Remove file"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* File menu */}
      {showFileMenu && (
        <div style={styles.fileMenu as Preact.CSSProperties}>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            style={hiddenInputStyles}
            onChange={handleFileChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={config.allowedFileTypes.join(',')}
            multiple
            style={hiddenInputStyles}
            onChange={handleFileChange}
          />
          <button
            style={styles.fileOption}
            onClick={() => imageInputRef.current?.click()}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = config.primaryColor;
              e.currentTarget.style.backgroundColor = `${config.primaryColor}10`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <svg width="24" height="24" fill={config.primaryColor} viewBox="0 0 24 24">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            </svg>
            <span style={{ fontSize: 10, color: '#6b7280', fontFamily: config.fontFamily }}>
              Photo
            </span>
          </button>
          {config.enableFileUpload && (
            <button
              style={styles.fileOption}
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = config.primaryColor;
                e.currentTarget.style.backgroundColor = `${config.primaryColor}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.backgroundColor = '#ffffff';
              }}
            >
              <svg width="24" height="24" fill={config.primaryColor} viewBox="0 0 24 24">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
              </svg>
              <span style={{ fontSize: 10, color: '#6b7280', fontFamily: config.fontFamily }}>
                File
              </span>
            </button>
          )}
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && config.enableEmoji && (
        <div style={styles.emojiPicker}>
          <div style={styles.emojiGrid}>
            {commonEmojis.map((emoji) => (
              <button
                key={emoji}
                style={styles.emoji}
                onClick={() => handleEmojiSelect(emoji)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={styles.inputWrapper}>
        <textarea
          ref={textareaRef}
          style={styles.textarea}
          value={message}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={config.inputPlaceholder}
          disabled={isDisabled}
          rows={1}
        />
        <div style={styles.actions}>
          {/* File attachment button */}
          {config.enableFileUpload && (
            <button
              style={styles.actionBtn}
              onClick={() => {
                setShowFileMenu(!showFileMenu);
                setShowEmojiPicker(false);
              }}
              disabled={isDisabled}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="Attach file"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
              </svg>
            </button>
          )}

          {/* Emoji button */}
          {config.enableEmoji && (
            <button
              style={styles.actionBtn}
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowFileMenu(false);
              }}
              disabled={isDisabled}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label="Insert emoji"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
              </svg>
            </button>
          )}

          {/* Send button */}
          <button
            style={styles.sendBtn}
            onClick={handleSubmit}
            disabled={isDisabled || (!message.trim() && !fileUploads.some((f) => f.status === 'success'))}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MessageInput;
