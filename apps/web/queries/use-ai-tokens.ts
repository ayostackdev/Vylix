'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

export interface AiTokensData {
  daily_tokens_used: number;
  daily_tokens_limit: number;
  is_premium: boolean;
}

export function useAiTokens() {
  const supabase = getSupabaseBrowserClient();

  return useQuery({
    queryKey: ['ai-tokens'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch('/api/user/ai-tokens', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch AI tokens');

      return res.json() as Promise<AiTokensData>;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
