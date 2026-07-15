'use client';

import { useStreakAndPoints, useCheckIn } from '@/queries/use-gamification';
import { useAuth } from '@/context/auth-context';

export function StreakBanner() {
  const { isAuthenticated, promptLogin } = useAuth();
  const { data: stats } = useStreakAndPoints();
  const checkIn = useCheckIn();

  if (!isAuthenticated) return null;

  const streak = stats?.current_streak ?? 0;

  return (
    <div className="rounded-2xl border border-orange-200/60 bg-gradient-to-r from-orange-50 via-amber-50/80 to-yellow-50/60 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="text-3xl">
              {streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : streak > 0 ? '✨' : '📅'}
            </span>
            {streak >= 7 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 tracking-tight">
              {streak > 0 ? (
                <>
                  <span className="bg-gradient-to-r from-orange-500 via-red-500 to-amber-500 bg-clip-text text-transparent">
                    {streak} day streak
                  </span>
                  {streak >= 7 && <span className="ml-2 text-xs text-orange-600 font-semibold">On fire!</span>}
                </>
              ) : (
                'Start your streak today'
              )}
            </p>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">
              {stats?.longest_streak ? `Longest: ${stats.longest_streak} days` : 'Check in daily to build your streak'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (!isAuthenticated) { promptLogin('check in daily'); return; }
            checkIn.mutate();
          }}
          disabled={checkIn.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all disabled:opacity-50 active:scale-95"
        >
          {checkIn.isPending ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : checkIn.isSuccess ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {checkIn.isSuccess ? `+${checkIn.data?.points_earned ?? 10} pts` : 'Check In'}
        </button>
      </div>
    </div>
  );
}
