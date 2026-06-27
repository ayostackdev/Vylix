'use client';

import { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { useCreateConversation, type ConversationDetail } from '@/queries/use-collaboration';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (conv: ConversationDetail) => void;
}

export function NewConversationModal({ isOpen, onClose, onCreated }: NewConversationModalProps) {
  const { user } = useAuth();
  const createConversation = useCreateConversation();

  const [type, setType] = useState<'DIRECT' | 'GROUP'>('DIRECT');
  const [title, setTitle] = useState('');
  const [memberIdsInput, setMemberIdsInput] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const memberIds = memberIdsInput
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (memberIds.length === 0) return;

    try {
      const conv = await createConversation.mutateAsync({
        type,
        title: type === 'GROUP' ? title.trim() || undefined : undefined,
        memberIds,
      });
      onCreated(conv);
      setTitle('');
      setMemberIdsInput('');
      onClose();
    } catch {
      // error handled by mutation
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-blue-100">
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-emerald-50/35 px-6 py-4">
          <h2 className="text-lg font-black text-gray-900">New Conversation</h2>
          <p className="text-sm text-gray-600 mt-1">Start a chat with classmates</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label className="cp-label mb-1.5 block text-gray-700">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('DIRECT')}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  type === 'DIRECT'
                    ? 'bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Direct
              </button>
              <button
                type="button"
                onClick={() => setType('GROUP')}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  type === 'GROUP'
                    ? 'bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Group
              </button>
            </div>
          </div>

          {type === 'GROUP' && (
            <div>
              <label className="cp-label mb-1.5 block text-gray-700">Group title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Group study session"
                className="w-full rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-200"
              />
            </div>
          )}

          <div>
            <label className="cp-label mb-1.5 block text-gray-700">
              Member IDs {user && <span className="font-normal text-gray-500">(yours: {user.id.slice(0, 8)}...)</span>}
            </label>
            <input
              value={memberIdsInput}
              onChange={(e) => setMemberIdsInput(e.target.value)}
              placeholder={type === 'DIRECT' ? 'Enter the other user ID' : 'user-id1, user-id2, ...'}
              className="w-full rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-200"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Separate multiple IDs with commas, spaces, or semicolons
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-blue-100 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-blue-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createConversation.isPending || !memberIdsInput.trim()}
              className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-40"
            >
              {createConversation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
