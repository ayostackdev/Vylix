'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { API_BASE } from '@/lib/api-base';
export const API_PREFIX = '/api/v1';

export async function authFetch(path: string, options?: RequestInit): Promise<unknown> {
  const supabase = getSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const versionedPath = path.startsWith('/api/') ? path.replace('/api/', `${API_PREFIX}/`) : `${API_PREFIX}${path}`;

  const res = await fetch(`${API_BASE}${versionedPath}`, {
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
