'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface PrivacySettings {
  is_stealth_mode: boolean;
  show_contributions: boolean;
  show_email: boolean;
  show_department: boolean;
}

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
}

export interface UserBadge {
  badge: Badge;
  earned_at: string | null;
}

export interface ContributionLeaderboardEntry {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  contribution_score: number;
}

export interface PublicProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  contribution_score: number;
  department_name: string | null;
  college_name: string | null;
}

export function usePrivacy(userId: string | null) {
  return useQuery({
    queryKey: ['privacy', userId],
    queryFn: () => authFetch(`/api/settings/privacy/${userId}`) as Promise<PrivacySettings>,
    enabled: !!userId,
  });
}

export function useUpdatePrivacy(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<PrivacySettings>) =>
      authFetch(`/api/settings/privacy/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }) as Promise<PrivacySettings>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['privacy', userId] });
    },
  });
}

export function useToggleStealth(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      authFetch(`/api/settings/stealth-mode/${userId}`, { method: 'POST' }) as Promise<{ is_stealth_mode: boolean }>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['privacy', userId] });
    },
  });
}

export function usePublicProfile(userId: string | null) {
  return useQuery({
    queryKey: ['public-profile', userId],
    queryFn: () => authFetch(`/api/settings/public-profile/${userId}`) as Promise<PublicProfile>,
    enabled: !!userId,
  });
}

export function useUserBadges(userId: string | null) {
  return useQuery({
    queryKey: ['badges', userId],
    queryFn: () => authFetch(`/api/settings/badges/${userId}`) as Promise<UserBadge[]>,
    enabled: !!userId,
  });
}

export function useAllBadges() {
  return useQuery({
    queryKey: ['badges-all'],
    queryFn: () => authFetch('/api/settings/badges/all') as Promise<Badge[]>,
    staleTime: 300_000,
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => authFetch('/api/settings/leaderboard') as Promise<ContributionLeaderboardEntry[]>,
    staleTime: 60_000,
  });
}
