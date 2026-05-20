'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;

  return url;
}

function getSupabaseAnonKey() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) return null;

  return anonKey;
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
      return createFallbackClient();
    }

    supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseClient;
}