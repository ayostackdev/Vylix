'use client';

import { useRef, useState } from 'react';
import { useEmojiPicker } from '@/hooks/useEmojiPicker';
import { EmojiPicker } from '@/components/ui/EmojiPicker';

interface MessageInputProps {
  placeholder?: string;
  onSubmit: (message: string) => Promise<void>;
  isLoading?: boolean;
  maxLength?: number;
}

export function MessageInput({
  placeholder = 'Write a message...',
  onSubmit,
  isLoading = false,
  maxLength = 500,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { showEmojiPicker, toggleEmojiPicker, closeEmojiPicker } = useEmojiPicker();
  const [error, setError] = useState<string | null>(null);

  const handleAddEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const newMessage = message.slice(0, cursorPos) + emoji + message.slice(cursorPos);

    if (newMessage.length <= maxLength) {
      setMessage(newMessage);
      // Move cursor after emoji
      setTimeout(() => {
        textarea.selectionStart = cursorPos + emoji.length;
        textarea.selectionEnd = cursorPos + emoji.length;
        textarea.focus();
      }, 0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      setError('Message cannot be empty');
      return;
    }

    if (message.length > maxLength) {
      setError(`Message must be under ${maxLength} characters`);
      return;
    }

    try {
      setError(null);
      await onSubmit(message);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd/Ctrl + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      setMessage(newValue);
      closeEmojiPicker();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          rows={3}
        />

        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {message.length}/{maxLength}
          </span>

          <button
            type="button"
            onClick={toggleEmojiPicker}
            className="text-lg hover:bg-gray-100 rounded p-1 transition"
            title="Add emoji"
          >
            😊
          </button>
        </div>
      </div>

      <EmojiPicker
        onEmojiSelect={handleAddEmoji}
        isOpen={showEmojiPicker}
        onClose={closeEmojiPicker}
      />

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading || !message.trim()}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </form>
  );
}
