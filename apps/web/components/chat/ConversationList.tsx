'use client';

import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { SkeletonRow } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import { useConversations } from '@/queries/use-collaboration';

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onClassmates: () => void;
}

function conversationTitle(conv: {
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  members: { role: string; user: { id: string; fullName: string; avatarUrl: string | null } }[];
}, currentUserId: string): string {
  if (conv.title) return conv.title;
  if (conv.type === 'DIRECT') {
    const other = conv.members.find((m) => m.user.id !== currentUserId);
    return other?.user.fullName ?? 'Unknown';
  }
  return conv.members.map((m) => m.user.fullName).join(', ');
}

function conversationAvatar(conv: {
  type: 'DIRECT' | 'GROUP';
  members: { role: string; user: { id: string; fullName: string; avatarUrl: string | null } }[];
}, currentUserId: string) {
  if (conv.type === 'DIRECT') {
    const other = conv.members.find((m) => m.user.id !== currentUserId);
    return {
      src: other?.user.avatarUrl ?? undefined,
      fallback: (other?.user.fullName ?? '?').charAt(0),
    };
  }
  return { src: undefined, fallback: '#' };
}

export function ConversationList({ selectedId, onSelect, onCreateNew, onClassmates }: ConversationListProps) {
  const { user } = useAuth();
  const { data: conversations, isLoading } = useConversations();
  const currentUserId = user?.id ?? '';
  const [filter, setFilter] = useState<'all' | 'groups' | 'directs'>('all');

  const sorted = useMemo(() => {
    if (!conversations) return [];
    return [...conversations].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [conversations]);

  const filtered = useMemo(() => {
    if (filter === 'groups') return sorted.filter((c) => c.type === 'GROUP');
    if (filter === 'directs') return sorted.filter((c) => c.type === 'DIRECT');
    return sorted;
  }, [sorted, filter]);

  const groupCount = sorted.filter((c) => c.type === 'GROUP').length;
  const directCount = sorted.filter((c) => c.type === 'DIRECT').length;
  const totalUnread = sorted.reduce((sum, c) => sum + (c.membership?.unreadCount ?? 0), 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-blue-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="cp-card-title text-gray-900">Messages</h3>
            {totalUnread > 0 && (
              <Badge variant="live" className="px-1.5 py-0.5 text-[9px]">{totalUnread}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClassmates}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-50 transition-all"
              title="Find classmates"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">Classmates</span>
            </button>
            <button
              onClick={onCreateNew}
              className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-400 px-2 py-1.5 text-[10px] font-bold text-white shadow-md hover:shadow-lg transition-all"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 mt-2.5">
          {[
            { key: 'all' as const, label: 'All', count: sorted.length },
            { key: 'groups' as const, label: 'Groups', count: groupCount },
            { key: 'directs' as const, label: 'Direct', count: directCount },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                filter === f.key
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-gray-50/80 text-gray-500 border-gray-200/80 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {f.label}
              {f.count > 0 && <span className="ml-1 text-[9px] opacity-60">{f.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-sky-50 flex items-center justify-center mb-3 ring-1 ring-blue-100/50">
              <span className="text-2xl">
                {filter === 'groups' ? '👥' : filter === 'directs' ? '💬' : '💬'}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {filter === 'groups' ? 'No study groups yet' : filter === 'directs' ? 'No direct messages' : 'No conversations yet'}
            </p>
            <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
              {filter === 'groups'
                ? 'Create a study group to collaborate with classmates'
                : 'Start a chat with a classmate'}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {filtered.map((conv) => {
              const title = conversationTitle(conv, currentUserId);
              const avatar = conversationAvatar(conv, currentUserId);
              const lastMsg = conv.messages[0];
              const isSelected = conv.id === selectedId;
              const unread = conv.membership?.unreadCount ?? 0;

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`w-full rounded-xl p-3 text-left transition-all hover:bg-blue-50 active:scale-[0.99] ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-50 to-sky-50/35 ring-1 ring-blue-200'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {conv.type === 'GROUP' ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm ring-2 ring-blue-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    ) : (
                      <Avatar className="h-10 w-10 shrink-0 shadow-sm ring-2 ring-blue-100">
                        <AvatarImage src={avatar.src} />
                        <AvatarFallback className="bg-green-50 font-bold text-gray-900 text-sm">
                          {avatar.fallback}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {conv.type === 'GROUP' && (
                            <svg className="w-3 h-3 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          )}
                          <p className="truncate text-sm font-bold text-gray-900">{title}</p>
                        </div>
                        {unread > 0 && (
                          <Badge variant="live" className="shrink-0 px-1.5 py-0.5 text-[9px]">
                            {unread}
                          </Badge>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="mt-0.5 truncate text-xs text-gray-600">
                          {conv.type === 'GROUP' && <span className="font-semibold text-gray-700">{lastMsg.sender.fullName}: </span>}
                          {lastMsg.content}
                        </p>
                      )}
                      {conv.type === 'GROUP' && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[9px] text-gray-400 font-medium">
                            {conv.members.length} members
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
