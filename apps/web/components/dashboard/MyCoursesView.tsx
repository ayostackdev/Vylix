'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

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

export function MyCoursesView() {
  const { user, isAuthenticated, promptLogin } = useAuth();
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [points, setPoints] = useState(0);
  const [checkingIn, setCheckingIn] = useState(false);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';

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
    try {
      const headers = await authHeaders();
      const res = await fetch(`${apiBaseUrl}/api/courses/my`, { headers });
      if (res.ok) setCourses(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [isAuthenticated, apiBaseUrl, authHeaders]);

  const fetchStreak = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${apiBaseUrl}/api/user/streak`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStreak(data.streak ?? null);
        setPoints(data.points ?? 0);
      }
    } catch { /* ignore */ }
  }, [isAuthenticated, apiBaseUrl, authHeaders]);

  useEffect(() => {
    fetchCourses();
    fetchStreak();
  }, [fetchCourses, fetchStreak]);

  const handleCheckIn = async () => {
    if (!isAuthenticated) { promptLogin('track your study streak'); return; }
    setCheckingIn(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${apiBaseUrl}/api/user/check-in`, {
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
      <div className="rounded-[1.75rem] border border-blue-100 bg-gradient-to-br from-blue-50 to-emerald-50/35 p-6 text-center shadow-sm">
        <p className="mb-2 text-3xl">📚</p>
        <h3 className="mb-1 text-lg font-black text-gray-900">My Courses</h3>
        <p className="mb-4 text-sm text-gray-600">
          Set your level and department in your profile to see your semester courses and past questions.
        </p>
        <button
          onClick={() => promptLogin('set up your courses')}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          Sign In to Get Started
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-8 text-center">
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
              className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-gray-900">{course.code}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-600">{course.title}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
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
