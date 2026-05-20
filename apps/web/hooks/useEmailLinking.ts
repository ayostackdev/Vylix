import { useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

interface LinkEmailOptions {
  userId: string;
  email: string;
  provider?: 'google' | 'github' | 'email';
}

export function useEmailLinking() {
  const supabaseClient = getSupabaseBrowserClient();

  const linkIdentity = useCallback(
    async (options: LinkEmailOptions) => {
      try {
        const { userId, email, provider = 'email' } = options;

        // Get current session
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }

        // Step 1: Link identity to Supabase (if using OAuth)
        if (provider !== 'email') {
          await supabaseClient.auth.linkIdentity({
            provider: provider as 'google' | 'github',
          });
        }

        // Step 2: Call backend API to create UserEmail record
        const response = await fetch('/api/auth/link-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId,
            email,
            provider,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to link email: ${response.statusText}`);
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Error linking identity:', error);
        throw error;
      }
    },
    [supabaseClient]
  );

  const setPrimaryEmail = useCallback(
    async (userId: string, email: string) => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }

        const response = await fetch(`/api/auth/primary-email/${userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ email }),
        });

        if (!response.ok) {
          throw new Error(`Failed to set primary email: ${response.statusText}`);
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Error setting primary email:', error);
        throw error;
      }
    },
    [supabaseClient]
  );

  const getUserEmails = useCallback(
    async (userId: string) => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }

        const response = await fetch(`/api/auth/emails/${userId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch emails: ${response.statusText}`);
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error('Error fetching emails:', error);
        throw error;
      }
    },
    [supabaseClient]
  );

  return {
    linkIdentity,
    setPrimaryEmail,
    getUserEmails,
  };
}
