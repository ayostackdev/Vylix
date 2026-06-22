'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    console.warn('[supabase] NEXT_PUBLIC_SUPABASE_URL is not set');
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      console.warn('[supabase] Invalid protocol:', parsedUrl.protocol);
      return null;
    }
  } catch {
    console.warn('[supabase] Failed to parse URL:', url);
    return null;
  }

  return url;
}

function getSupabaseAnonKey() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const resolvedKey = anonKey || publishableKey;
  if (!resolvedKey) {
    console.warn('[supabase] No anon key found');
    return null;
  }

  return resolvedKey;
}

function createFallbackClient(): SupabaseClient {
  const emptySession = { data: { session: null }, error: null } as const;
  const emptyUser = { data: { user: null }, error: null } as const;
  const emptyAuthResult = { data: { user: null, session: null }, error: null } as const;

  return {
    auth: {
      getSession: async () => emptySession,
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => undefined,
          },
        },
      }),
      signInWithPassword: async () => emptyAuthResult,
      signInWithOAuth: async () => ({ data: null, error: null }),
      signUp: async () => emptyAuthResult,
      signOut: async () => ({ error: null }),
      getUser: async () => emptyUser,
      linkIdentity: async () => ({ data: null, error: null }),
      updateUser: async () => emptyUser,
      unlinkIdentity: async () => ({ data: null, error: null }),
    },
  } as unknown as SupabaseClient;
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!supabaseClient) {
    const url = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();

    if (!url || !anonKey) {
      console.warn('[supabase] Using fallback client (url=%s, anonKey=%s)', !!url, !!anonKey);
      return createFallbackClient();
    }

    console.log('[supabase] Initialized real client');
    supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }

  return supabaseClient;
}