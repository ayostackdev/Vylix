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

export interface QnaAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  contributionScore?: number;
}

export interface QnaAnswer {
  id: string;
  content: string;
  helpCount: number;
  isAccepted: boolean;
  createdAt: string;
  author: QnaAuthor;
}

export interface QnaQuestion {
  id: string;
  title: string;
  content: string;
  helpCount: number;
  viewCount: number;
  isResolved: boolean;
  createdAt: string;
  topicId?: string;
  author: QnaAuthor;
  answers: QnaAnswer[];
}

export interface TopAnswerer {
  userId: string;
  answerCount: number;
  helpfulCount: number;
}

export interface CourseInfo {
  id: string;
  code: string;
  title: string;
  level: number;
  isGeneral: boolean;
  pastQuestionCount: number;
}

export interface TopicInfo {
  id: string;
  title: string;
  courseId: string;
  authorId: string;
  isActive: boolean;
  lastActivity: string;
  author: { id: string; fullName: string; departmentId: string | null };
}

function useSession() {
  return useQuery({
    queryKey: ['supabase-session'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },
    staleTime: Infinity,
  });
}

function useLazyAuthFetch() {
  const { data: session } = useSession();

  return async (path: string, options?: RequestInit) => {
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
  };
}

export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const res = await fetch(`${API_BASE}/api/courses/my`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch courses');
      return res.json() as Promise<CourseInfo[]>;
    },
    staleTime: 60_000,
  });
}

export function useTopics(courseId: string | null) {
  return useQuery({
    queryKey: ['topics', courseId],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${API_BASE}/api/topics/course/${courseId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch topics');
      return res.json() as Promise<TopicInfo[]>;
    },
    enabled: !!courseId,
    staleTime: 60_000,
  });
}

export function useTopicQuestions(topicId: string | null) {
  return useQuery({
    queryKey: ['qna-questions', topicId],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`${API_BASE}/api/qna/topics/${topicId}/questions?limit=50`, { headers });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || 'Failed to fetch questions');
      }
      const json = await res.json();
      return (json.data ?? json) as QnaQuestion[];
    },
    enabled: !!topicId,
    staleTime: 30_000,
  });
}

export function useTrendingQuestions() {
  return useQuery({
    queryKey: ['qna-trending'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`${API_BASE}/api/qna/trending?limit=5`, { headers });
      if (!res.ok) throw new Error('Failed to fetch trending');
      const json = await res.json();
      return (json.data ?? json) as QnaQuestion[];
    },
    staleTime: 60_000,
  });
}

export function useSearchQuestions(query: string) {
  return useQuery({
    queryKey: ['qna-search', query],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`${API_BASE}/api/qna/search?q=${encodeURIComponent(query)}&limit=20`, { headers });
      if (!res.ok) throw new Error('Search failed');
      const json = await res.json();
      return (json.data ?? json) as QnaQuestion[];
    },
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}

export function useTopAnswerers(topicId: string | null) {
  return useQuery({
    queryKey: ['qna-top-answerers', topicId],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`${API_BASE}/api/qna/topics/${topicId}/top-answerers?limit=5`, { headers });
      if (!res.ok) throw new Error('Failed to fetch top answerers');
      const json = await res.json();
      return (json.data ?? json) as TopAnswerer[];
    },
    enabled: !!topicId,
    staleTime: 120_000,
  });
}

export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ topicId, title, content }: { topicId: string; title: string; content: string }) => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${API_BASE}/api/qna/topics/${topicId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || 'Failed to create question');
      }
      const json = await res.json();
      return json.data ?? json;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['qna-questions', variables.topicId] });
      qc.invalidateQueries({ queryKey: ['qna-trending'] });
    },
  });
}

export function useCreateAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, content }: { questionId: string; content: string }) => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${API_BASE}/api/qna/questions/${questionId}/answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || 'Failed to submit answer');
      }
      const json = await res.json();
      return json.data ?? json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qna-questions'] });
    },
  });
}

export function useMarkHelpful() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (answerId: string) => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${API_BASE}/api/qna/answers/${answerId}/helpful`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to mark helpful');
      const json = await res.json();
      return json.data ?? json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qna-questions'] });
    },
  });
}

export function useAcceptAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ questionId, answerId }: { questionId: string; answerId: string }) => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${API_BASE}/api/qna/questions/${questionId}/answers/${answerId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to accept answer');
      const json = await res.json();
      return json.data ?? json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qna-questions'] });
    },
  });
}
