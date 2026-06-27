'use client';

import { useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { SkeletonRow } from '@/components/ui/skeleton';
import { useConversations } from '@/queries/use-collaboration';

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
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

export function ConversationList({ selectedId, onSelect, onCreateNew }: ConversationListProps) {
  const { data: conversations, isLoading } = useConversations();
  const currentUserId = typeof window !== 'undefined'
    ? (document.cookie.match(/sb-user-id=([^;]+)/)?.[1] ?? '')
    : '';

  const sorted = useMemo(() => {
    if (!conversations) return [];
    return [...conversations].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [conversations]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-blue-100 px-4 py-3">
        <h3 className="cp-card-title text-gray-900">Messages</h3>
        <button
          onClick={onCreateNew}
          className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-3xl mb-3">💬</span>
            <p className="cp-body text-sm text-gray-600">No conversations yet</p>
            <p className="text-xs text-gray-500 mt-1">Start a new chat with a classmate</p>
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {sorted.map((conv) => {
              const title = conversationTitle(conv, currentUserId);
              const avatar = conversationAvatar(conv, currentUserId);
              const lastMsg = conv.messages[0];
              const isSelected = conv.id === selectedId;

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`w-full rounded-xl p-3 text-left transition-all hover:bg-blue-50 active:scale-[0.99] ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-50 to-emerald-50/35 ring-1 ring-blue-200'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0 shadow-sm ring-2 ring-blue-100">
                      <AvatarImage src={avatar.src} />
                      <AvatarFallback className="bg-green-50 font-bold text-gray-900 text-sm">
                        {avatar.fallback}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold text-gray-900">{title}</p>
                        {conv.membership.unreadCount > 0 && (
                          <Badge variant="live" className="shrink-0 px-2 py-0.5 text-[10px]">
                            {conv.membership.unreadCount}
                          </Badge>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="mt-0.5 truncate text-xs text-gray-600">
                          {lastMsg.sender.fullName}: {lastMsg.content}
                        </p>
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
