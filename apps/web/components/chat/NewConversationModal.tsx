'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import { useCreateConversation, useSearchUsers, type UserSearchResult, type ConversationDetail } from '@/queries/use-collaboration';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);

  const { data: searchResults, isLoading: searching } = useSearchUsers(searchQuery);

  if (!isOpen) return null;

  const handleSelectUser = (u: UserSearchResult) => {
    if (selectedUsers.some((s) => s.id === u.id)) {
      setSelectedUsers((prev) => prev.filter((s) => s.id !== u.id));
    } else if (type === 'DIRECT') {
      setSelectedUsers([u]);
    } else {
      setSelectedUsers((prev) => [...prev, u]);
    }
    setSearchQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedUsers.length === 0) return;

    try {
      const conv = await createConversation.mutateAsync({
        type,
        title: type === 'GROUP' ? title.trim() || undefined : undefined,
        memberIds: selectedUsers.map((u) => u.id),
      });
      onCreated(conv);
      setTitle('');
      setSelectedUsers([]);
      setSearchQuery('');
      onClose();
    } catch {
      // error handled by mutation
    }
  };

  const availableResults = (searchResults ?? []).filter(
    (u) => u.id !== user?.id && !selectedUsers.some((s) => s.id === u.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-blue-100">
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-emerald-50/35 px-6 py-4">
          <h2 className="text-lg font-black text-gray-900">New Conversation</h2>
          <p className="text-sm text-gray-600 mt-1">Search for classmates by name</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label className="cp-label mb-1.5 block text-gray-700">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setType('DIRECT'); setSelectedUsers([]); }}
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
                onClick={() => { setType('GROUP'); }}
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
              {type === 'DIRECT' ? 'Find a classmate' : 'Add members'}
            </label>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type a name..."
              className="w-full rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-200"
            />

            {searchQuery.trim().length >= 2 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-blue-100 bg-white shadow-lg">
                {searching ? (
                  <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
                ) : availableResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">No users found</div>
                ) : (
                  availableResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition"
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={u.avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-green-50 text-sm font-bold text-gray-900">
                          {u.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{u.fullName}</p>
                        <p className="text-xs text-gray-500">
                          {u.department?.code ?? ''}{u.currentLevel ? ` · ${u.currentLevel}` : ''}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedUsers.length > 0 && (
            <div>
              <label className="cp-label mb-1.5 block text-gray-700">
                Selected ({selectedUsers.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px] shadow-sm"
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-900">
                      {u.fullName}
                      <button
                        type="button"
                        onClick={() => setSelectedUsers((prev) => prev.filter((s) => s.id !== u.id))}
                        className="text-gray-500 hover:text-red-600 font-bold ml-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-blue-100 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-blue-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createConversation.isPending || selectedUsers.length === 0}
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
