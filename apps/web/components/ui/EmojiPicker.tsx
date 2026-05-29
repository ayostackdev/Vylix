'use client';

import { EMOJI_CATEGORIES } from '@/hooks/useEmojiPicker';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function EmojiPicker({ onEmojiSelect, isOpen, onClose }: EmojiPickerProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Emoji Picker */}
      <div className="emoji-picker">
        <div className="space-y-2">
          {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
            <div key={category}>
              <p className="mb-1 text-xs font-medium text-gray-600 capitalize">{category}</p>
              <div className="emoji-grid">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onEmojiSelect(emoji);
                      onClose();
                    }}
                    className="emoji-item"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
