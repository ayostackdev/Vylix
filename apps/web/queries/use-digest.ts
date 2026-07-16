'use client';

import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/auth-fetch';

export interface CourseActivity {
  course_id: string;
  course_code: string;
  course_title: string;
  new_materials: number;
  new_questions: number;
  active_classmates: number;
}

export interface RecentQuestion {
  id: string;
  title: string;
  course_code: string;
  course_title: string;
  created_at: string | null;
}

export interface DailyDigest {
  greeting: string;
  streak: number;
  total_points: number;
  new_notifications: number;
  courses_with_activity: CourseActivity[];
  recent_questions: RecentQuestion[];
  study_tip: string;
}

export interface ClassmateActive {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  last_active_at: string | null;
}

export interface SocialPresence {
  active_now: number;
  active_today: number;
  classmates_active: ClassmateActive[];
}

export function useDailyDigest() {
  return useQuery({
    queryKey: ['digest-daily'],
    queryFn: () => authFetch('/api/digest/daily') as Promise<DailyDigest>,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useSocialPresence() {
  return useQuery({
    queryKey: ['digest-social-presence'],
    queryFn: () => authFetch('/api/digest/social-presence') as Promise<SocialPresence>,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
