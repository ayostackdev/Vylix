'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useStreakLeaderboard, usePointsLeaderboard } from '@/queries/use-gamification';
import { useAuth } from '@/context/auth-context';

type Tab = 'streaks' | 'points';

export function LeaderboardPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('points');
  const { data: streakBoard, isLoading: streakLoading } = useStreakLeaderboard();
  const { data: pointsBoard, isLoading: pointsLoading } = usePointsLeaderboard();

  const entries = tab === 'streaks' ? streakBoard : pointsBoard;
  const loading = tab === 'streaks' ? streakLoading : pointsLoading;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-sm font-bold text-gray-900 tracking-tight">Leaderboard</h3>
      </div>

      <div className="px-4 pb-2">
        <div className="flex rounded-xl bg-gray-100 p-0.5">
          <button
            onClick={() => setTab('points')}
            className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-all ${
              tab === 'points' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Points
          </button>
          <button
            onClick={() => setTab('streaks')}
            className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-all ${
              tab === 'streaks' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Streaks
          </button>
        </div>
      </div>

      <div className="px-2 pb-3">
        {loading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse px-2 py-2">
                <div className="w-5 h-5 rounded bg-gray-200" />
                <div className="h-8 w-8 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 rounded bg-gray-200" />
                  <div className="h-2 w-16 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
          ) : !entries || entries.length === 0 ? (
          <div className="py-8 text-center">
            <span className="text-2xl">🏆</span>
            <p className="text-xs text-gray-500 font-medium mt-2">No entries yet</p>
            <p className="text-[10px] text-gray-400">Be the first on the leaderboard!</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {entries.map((entry, i) => {
              const isMe = entry.user_id === user?.id;
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                    isMe ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="w-5 text-center text-sm shrink-0">
                    {i < 3 ? medals[i] : (
                      <span className="text-[11px] font-bold text-gray-400">{i + 1}</span>
                    )}
                  </span>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={entry.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-green-50 text-[10px] font-bold text-gray-900">
                      {entry.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isMe ? 'text-blue-700' : 'text-gray-900'}`}>
                      {entry.full_name} {isMe && <span className="text-[10px] font-bold text-blue-500">(you)</span>}
                    </p>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${tab === 'streaks' ? 'text-orange-600' : 'text-blue-600'}`}>
                    {entry.value.toLocaleString()}{tab === 'streaks' ? 'd' : ' pts'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
