'use client';

import { useStreakAndPoints } from '@/queries/use-gamification';
import { useAuth } from '@/context/auth-context';

export function PointsCounter() {
  const { isAuthenticated } = useAuth();
  const { data: stats } = useStreakAndPoints();

  if (!isAuthenticated) return null;

  const points = stats?.total_points ?? 0;
  const level = points >= 1000 ? 'Platinum' : points >= 500 ? 'Gold' : points >= 200 ? 'Silver' : 'Bronze';
  const levelColor = points >= 1000 ? 'from-sky-500 to-sky-600' : points >= 500 ? 'from-yellow-500 to-amber-500' : points >= 200 ? 'from-gray-400 to-gray-500' : 'from-orange-400 to-orange-500';

  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${levelColor} flex items-center justify-center shadow-sm`}>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Points</p>
          <p className="text-xl font-black tracking-tight text-gray-900">{points.toLocaleString()}</p>
        </div>
        <div className="ml-auto">
          <span className={`inline-flex items-center rounded-full bg-gradient-to-r ${levelColor} p-[1px] shadow-sm`}>
            <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-gray-900">
              {level}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
