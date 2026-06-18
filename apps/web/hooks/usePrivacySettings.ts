'use client';

import { useCallback, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

export interface PrivacySettings {
  isStealthMode: boolean;
  showContributions: boolean;
  showEmail: boolean;
  showDepartment: boolean;
}

export interface UserBadge {
  id: string;
  badge: {
    id: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  };
  earnedAt: string;
}

export interface UserBadgesResponse {
  userId: string;
  contributionScore: number;
  badges: UserBadge[];
  totalBadges: number;
}

/**
 * Hook for managing privacy settings including stealth mode
 */
export function usePrivacySettings() {
  const supabaseClient = getSupabaseBrowserClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPrivacySettings = useCallback(
    async (userId: string): Promise<PrivacySettings | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }

        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const response = await fetch(`${apiBaseUrl}/api/settings/privacy/${userId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch privacy settings: ${response.statusText}`);
        }

        return await response.json();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch settings';
        setError(errorMsg);
        console.error('Error fetching privacy settings:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [supabaseClient]
  );

  const updatePrivacySettings = useCallback(
    async (userId: string, settings: Partial<PrivacySettings>) => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }

        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const response = await fetch(`${apiBaseUrl}/api/settings/privacy/${userId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(settings),
        });

        if (!response.ok) {
          throw new Error(`Failed to update settings: ${response.statusText}`);
        }

        return await response.json();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update settings';
        setError(errorMsg);
        console.error('Error updating privacy settings:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [supabaseClient]
  );

  const toggleStealthMode = useCallback(
    async (userId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }

        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const response = await fetch(`${apiBaseUrl}/api/settings/stealth-mode/${userId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to toggle stealth mode: ${response.statusText}`);
        }

        return await response.json();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to toggle stealth mode';
        setError(errorMsg);
        console.error('Error toggling stealth mode:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [supabaseClient]
  );

  return {
    getPrivacySettings,
    updatePrivacySettings,
    toggleStealthMode,
    isLoading,
    error,
  };
}

/**
 * Hook for managing user badges and gamification
 */
export function useBadges() {
  const supabaseClient = getSupabaseBrowserClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getUserBadges = useCallback(
    async (userId: string): Promise<UserBadgesResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }

        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const response = await fetch(`${apiBaseUrl}/api/settings/badges/${userId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch badges: ${response.statusText}`);
        }

        return await response.json();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch badges';
        setError(errorMsg);
        console.error('Error fetching badges:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [supabaseClient]
  );

  const getLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/settings/leaderboard`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch leaderboard';
      setError(errorMsg);
      console.error('Error fetching leaderboard:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [supabaseClient]);

  const getAllBadges = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/settings/badges/all`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch badges: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch badges';
      setError(errorMsg);
      console.error('Error fetching badges:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [supabaseClient]);

  return {
    getUserBadges,
    getLeaderboard,
    getAllBadges,
    isLoading,
    error,
  };
}
