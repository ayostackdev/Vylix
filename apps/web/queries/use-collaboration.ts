'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

async function authFetch(path: string, options?: RequestInit) {
  const supabase = getSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
  }

  return res.json();
}

export interface UserBrief {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  departmentId: string | null;
}

export interface ConversationMember {
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  user: UserBrief;
}

export interface MessageReceipt {
  id: string;
  messageId: string;
  userId: string;
  readAt: string;
  user: UserBrief;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  metadata: Record<string, unknown> | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sender: UserBrief;
  receipts: MessageReceipt[];
}

export interface ConversationListItem {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  createdAt: string;
  updatedAt: string;
  members: ConversationMember[];
  messages: { id: string; content: string; createdAt: string; sender: UserBrief }[];
  membership: {
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    lastReadAt: string | null;
    joinedAt: string;
    unreadCount: number;
  };
}

export interface UserSearchResult {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  department: { code: string; name: string } | null;
  currentLevel: string | null;
  matricNumber: string | null;
}

export interface ConversationDetail {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  departmentId: string | null;
  topicId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  members: (ConversationMember & {
    id: string;
    conversationId: string;
    userId: string;
    lastReadAt: string | null;
    joinedAt: string;
  })[];
}

export interface UnreadSummary {
  totalUnreadMessages: number;
  unreadNotifications: number;
  conversations: { conversationId: string; unreadCount: number }[];
}

// ── Hooks ──────────────────────────────────────────────────────────

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => authFetch('/api/collaboration/conversations') as Promise<ConversationListItem[]>,
    refetchInterval: 30_000,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () =>
      authFetch(`/api/collaboration/conversations/${conversationId}/messages?take=50`) as Promise<Message[]>,
    enabled: !!conversationId,
  });
}

export function useUnreadSummary() {
  return useQuery({
    queryKey: ['unread-summary'],
    queryFn: () => authFetch('/api/collaboration/unread-summary') as Promise<UnreadSummary>,
    refetchInterval: 30_000,
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ['users', 'search', query],
    queryFn: () =>
      authFetch(`/api/collaboration/users/search?q=${encodeURIComponent(query)}`) as Promise<UserSearchResult[]>,
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}

export function useClassmates() {
  return useQuery({
    queryKey: ['users', 'classmates'],
    queryFn: () =>
      authFetch('/api/collaboration/users/classmates') as Promise<UserSearchResult[]>,
    staleTime: 60_000,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      type?: 'DIRECT' | 'GROUP';
      title?: string;
      memberIds?: string[];
    }) => authFetch('/api/collaboration/conversations', {
      method: 'POST',
      body: JSON.stringify(body),
    }) as Promise<ConversationDetail>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useSendMessage(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) =>
      authFetch(`/api/collaboration/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }) as Promise<Message>,
    onMutate: async ({ conversationId, content }) => {
      await qc.cancelQueries({ queryKey: ['messages', conversationId] });

      const previous = qc.getQueryData<Message[]>(['messages', conversationId]);

      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
        conversationId,
        senderId: userId ?? '',
        content,
        metadata: null,
        editedAt: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sender: {
          id: userId ?? '',
          fullName: '',
          avatarUrl: null,
          departmentId: null,
        },
        receipts: [],
      };

      qc.setQueryData<Message[]>(['messages', conversationId], (old) =>
        old ? [...old, optimistic] : [optimistic]
      );

      return { previous };
    },
    onSuccess: (data) => {
      qc.setQueryData<Message[]>(['messages', data.conversationId], (old) =>
        old ? old.map((m) => (m.id.startsWith('optimistic-') ? data : m)) : [data]
      );
      qc.invalidateQueries({ queryKey: ['messages', data.conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (_err, { conversationId }, context) => {
      if (context?.previous) {
        qc.setQueryData(['messages', conversationId], context.previous);
      }
    },
  });
}

export function useEditMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      authFetch(`/api/collaboration/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }) as Promise<Message>,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId }: { messageId: string }) =>
      authFetch(`/api/collaboration/messages/${messageId}`, {
        method: 'DELETE',
      }) as Promise<Message>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      messageId,
    }: {
      conversationId: string;
      messageId?: string;
    }) =>
      authFetch(`/api/collaboration/conversations/${conversationId}/read`, {
        method: 'POST',
        body: JSON.stringify({ messageId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['unread-summary'] });
    },
  });
}

export function useSendTyping() {
  return useMutation({
    mutationFn: ({
      conversationId,
      isTyping,
    }: {
      conversationId: string;
      isTyping: boolean;
    }) =>
      authFetch(`/api/collaboration/conversations/${conversationId}/typing`, {
        method: 'POST',
        body: JSON.stringify({ isTyping }),
      }),
  });
}
