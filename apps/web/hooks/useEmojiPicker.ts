'use client';

import { useState } from 'react';

// Categorized emojis for better organization
export const EMOJI_CATEGORIES = {
  reactions: ['👍', '❤️', '😂', '😮', '😢', '🔥', '✨', '👏'],
  study: ['📚', '📖', '✏️', '📝', '🎓', '💡', '🧠', '⚡'],
  feelings: ['😊', '😃', '😍', '🤔', '😅', '😎', '🥳', '😴'],
  symbols: ['✅', '❌', '⏰', '⭐', '💯', '🎯', '🚀', '📌'],
};

export function useEmojiPicker() {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof EMOJI_CATEGORIES>('reactions');

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  const closeEmojiPicker = () => {
    setShowEmojiPicker(false);
  };

  const getEmojisForCategory = (category: keyof typeof EMOJI_CATEGORIES) => {
    return EMOJI_CATEGORIES[category];
  };

  const getAllEmojis = () => {
    return Object.values(EMOJI_CATEGORIES).flat();
  };

  return {
    showEmojiPicker,
    setShowEmojiPicker,
    toggleEmojiPicker,
    closeEmojiPicker,
    selectedCategory,
    setSelectedCategory,
    getEmojisForCategory,
    getAllEmojis,
  };
}
