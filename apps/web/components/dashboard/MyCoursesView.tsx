'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

import { DailyDigestCard } from './DailyDigestCard';
import { SocialPresenceBanner } from './SocialPresenceBanner';

interface CourseInfo {
  id: string;
  code: string;
  title: string;
  level: number;
  isGeneral: boolean;
  pastQuestionCount: number;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityAt: string | null;
  streakStartedAt: string | null;
}

interface MyCoursesViewProps {
  onOpenProfile?: () => void;
}

export function MyCoursesView({ onOpenProfile }: MyCoursesViewProps) {
  const { user, isAuthenticated, promptLogin } = useAuth();
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [points, setPoints] = useState(0);
  const [checkingIn, setCheckingIn] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }, []);

  const fetchCourses = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    setFetchError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/courses/my`, { headers });
      if (res.ok) {
        setCourses(await res.json());
      } else {
        const text = await res.text().catch(() => '');
        setFetchError(`Server error (${res.status}${text ? ': ' + text.slice(0, 100) : ''})`);
      }
    } catch (err) {
      setFetchError(err instanceof TypeError ? 'Network error — check your connection' : 'Failed to load courses');
    }
    setLoading(false);
  }, [isAuthenticated, authHeaders]);

  const fetchStreak = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/user/streak`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStreak(data.streak ?? null);
        setPoints(data.points ?? 0);
      }
    } catch { /* ignore */ }
  }, [isAuthenticated, authHeaders]);

  useEffect(() => {
    fetchCourses();
    fetchStreak();
  }, [fetchCourses, fetchStreak, user?.departmentCode]);

  const handleCheckIn = async () => {
    if (!isAuthenticated) { promptLogin('track your study streak'); return; }
    setCheckingIn(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/user/check-in`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setStreak((prev) => prev ? { ...prev, currentStreak: data.currentStreak, longestStreak: data.longestStreak } : prev);
        setPoints((p) => p + data.pointsEarned);
      }
    } catch { /* ignore */ }
    setCheckingIn(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-[1.75rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50/35 p-6 text-center shadow-sm">
        <p className="mb-2 text-3xl">📚</p>
        <h3 className="mb-1 text-lg font-black text-gray-900">My Courses</h3>
        <p className="mb-4 text-sm text-gray-600">
          Set your level and department in your profile to see your semester courses and past questions.
        </p>
        <button
          onClick={() => promptLogin('set up your courses')}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          Sign In to Get Started
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Daily Digest */}
      <DailyDigestCard />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-gray-900">My Courses</h3>
          <p className="text-sm text-gray-600">
            {user?.currentLevel ?? ''} &middot; {user?.departmentName ?? ''}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500">Streak</p>
            <p className="text-xl font-black bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
              {streak?.currentStreak ?? 0}🔥
            </p>
          </div>
          <button
            onClick={handleCheckIn}
            disabled={checkingIn}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-xs font-bold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
          >
            {checkingIn ? '...' : 'Check In'}
          </button>
        </div>
      </div>

      {!user?.departmentCode && !loading ? (
        <div className="rounded-[1.75rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50/35 p-6 text-center shadow-sm">
          <p className="mb-2 text-3xl">🎓</p>
          <h3 className="mb-1 text-lg font-black text-gray-900">Set Up Your Profile</h3>
          <p className="mb-4 text-sm text-gray-600">
            Select your college and department to see your semester courses and past questions.
          </p>
          <button
            onClick={onOpenProfile}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            Open Profile Settings
          </button>
        </div>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : fetchError ? (
        <div className="rounded-xl border border-red-100 bg-red-50/50 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-red-700">Could not load courses</p>
          <p className="mt-1 text-xs text-red-500">{fetchError}</p>
          <button
            onClick={() => { setLoading(true); fetchCourses(); }}
            className="mt-3 inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-8 text-center">
          <p className="text-sm text-gray-600">
            No courses found for your level and department.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Update your profile or check back later.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-gray-900">{course.code}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-600">{course.title}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                  📄 {course.pastQuestionCount} past {course.pastQuestionCount === 1 ? 'question' : 'questions'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {points > 0 && (
        <p className="text-center text-xs text-gray-500">
          {points} total contribution points
        </p>
      )}
    </div>
  );
}
