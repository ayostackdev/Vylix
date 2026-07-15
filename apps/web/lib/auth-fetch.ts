'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase-client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export async function authFetch(path: string, options?: RequestInit): Promise<unknown> {
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
