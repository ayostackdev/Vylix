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

const GROUP_SUGGESTIONS = [
  { name: 'Study Group', icon: '📚', description: 'General study session' },
  { name: 'Exam Prep', icon: '📝', description: 'Exam preparation group' },
  { name: 'Assignment Help', icon: '🤝', description: 'Homework and assignment collaboration' },
  { name: 'Lab Partners', icon: '🔬', description: 'Laboratory work group' },
];

export function NewConversationModal({ isOpen, onClose, onCreated }: NewConversationModalProps) {
  const { user } = useAuth();
  const createConversation = useCreateConversation();

  const [type, setType] = useState<'DIRECT' | 'GROUP'>('DIRECT');
  const [title, setTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [step, setStep] = useState<'type' | 'members'>('type');

  const { data: searchResults, isLoading: searching } = useSearchUsers(searchQuery);

  if (!isOpen) return null;

  const handleSelectUser = (u: UserSearchResult) => {
    if (selectedUsers.some((s) => s.id === u.id)) {
      setSelectedUsers((prev) => prev.filter((s) => s.id !== u.id));
    } else if (type === 'DIRECT') {
      setSelectedUsers([u]);
      handleSubmitWithUsers([u]);
    } else {
      setSelectedUsers((prev) => [...prev, u]);
    }
    setSearchQuery('');
  };

  const handleSubmitWithUsers = async (users: UserSearchResult[]) => {
    if (users.length === 0) return;
    try {
      const conv = await createConversation.mutateAsync({
        type,
        title: type === 'GROUP' ? title.trim() || undefined : undefined,
        memberIds: users.map((u) => u.id),
      });
      onCreated(conv);
      resetForm();
      onClose();
    } catch {
      // error handled by mutation
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.length === 0) return;
    await handleSubmitWithUsers(selectedUsers);
  };

  const resetForm = () => {
    setTitle('');
    setSelectedUsers([]);
    setSearchQuery('');
    setStep('type');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const availableResults = (searchResults ?? []).filter(
    (u) => u.id !== user?.id && !selectedUsers.some((s) => s.id === u.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-blue-100 flex flex-col max-h-[85vh]">
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50/35 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-gray-900">
                {step === 'type' ? 'New Conversation' : type === 'GROUP' ? 'Create Study Group' : 'Start Chat'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {step === 'type'
                  ? 'Choose a conversation type'
                  : 'Search for classmates by name'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-blue-50 transition"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {step === 'type' ? (
          <div className="p-6 space-y-4">
            <button
              onClick={() => { setType('DIRECT'); setStep('members'); }}
              className="w-full flex items-center gap-4 rounded-xl border border-blue-100 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center shadow-sm shadow-blue-600/20 group-hover:shadow-md transition-shadow">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Direct Message</p>
                <p className="text-xs text-gray-500 mt-0.5">Chat privately with one classmate</p>
              </div>
            </button>

            <button
              onClick={() => { setType('GROUP'); setStep('members'); }}
              className="w-full flex items-center gap-4 rounded-xl border border-blue-100 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-sm shadow-emerald-500/20 group-hover:shadow-md transition-shadow">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Study Group</p>
                <p className="text-xs text-gray-500 mt-0.5">Create a group for collaborative study</p>
              </div>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            {type === 'GROUP' && (
              <div className="px-6 pt-4 pb-2 space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">Group Name</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., CSC 201 Study Group"
                    className="w-full rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {GROUP_SUGGESTIONS.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setTitle(s.name)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all ${
                        title === s.name
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-200 hover:bg-blue-50/50'
                      }`}
                    >
                      <span>{s.icon}</span>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-6 py-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
                {type === 'DIRECT' ? 'Find a classmate' : 'Add members'}
              </label>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type a name or matric number..."
                className="w-full rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-200"
                autoFocus
              />

              {searchQuery.trim().length >= 2 && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-blue-100 bg-white shadow-lg">
                  {searching ? (
                    <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Searching...
                    </div>
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
                            {u.matricNumber ? ` · ${u.matricNumber}` : ''}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedUsers.length > 0 && (
              <div className="px-6 pb-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
                  Selected ({selectedUsers.length})
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedUsers.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 p-[1px] shadow-sm"
                    >
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-900">
                        {u.fullName}
                        <button
                          type="button"
                          onClick={() => setSelectedUsers((prev) => prev.filter((s) => s.id !== u.id))}
                          className="text-gray-400 hover:text-red-600 font-bold"
                        >
                          x
                        </button>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 px-6 py-4 mt-auto border-t border-blue-100">
              <button
                type="button"
                onClick={() => { if (step === 'members' && type === 'GROUP') { setStep('type'); } else { handleClose(); } }}
                className="flex-1 rounded-xl border border-blue-100 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-blue-50 transition"
              >
                {step === 'members' && type === 'GROUP' ? 'Back' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={createConversation.isPending || selectedUsers.length === 0}
                className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-400 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-40"
              >
                {createConversation.isPending ? 'Creating...' : type === 'GROUP' ? 'Create Group' : 'Start Chat'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
