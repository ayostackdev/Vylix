'use client';

import { useUserBadges } from '@/queries/use-gamification';
import { useAuth } from '@/context/auth-context';

const RARITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  COMMON: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' },
  RARE: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600' },
  EPIC: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600' },
  LEGENDARY: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600' },
};

const RARITY_LABELS: Record<string, string> = {
  COMMON: 'Common',
  RARE: 'Rare',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary',
};

export function BadgeShowcase() {
  const { isAuthenticated } = useAuth();
  const { data: badges, isLoading } = useUserBadges();

  if (!isAuthenticated) return null;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 tracking-tight">Badges</h3>
        {badges && badges.length > 0 && (
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {badges.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-14 h-14 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : !badges || badges.length === 0 ? (
        <div className="py-6 text-center">
          <span className="text-2xl">🏅</span>
          <p className="text-xs text-gray-500 font-medium mt-2">No badges yet</p>
          <p className="text-[10px] text-gray-400">Complete activities to earn badges</p>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {badges.map((badge) => {
            const colors = RARITY_COLORS[badge.rarity] || RARITY_COLORS.COMMON;
            return (
              <div
                key={badge.id}
                className={`shrink-0 w-16 h-16 rounded-xl ${colors.bg} border ${colors.border} flex flex-col items-center justify-center gap-0.5 relative group cursor-default transition-all hover:scale-105`}
                title={`${badge.name}: ${badge.description}`}
              >
                <span className="text-xl">{badge.icon}</span>
                <span className={`text-[8px] font-bold ${colors.text}`}>
                  {RARITY_LABELS[badge.rarity] || badge.rarity}
                </span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-48 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                  <p className="text-xs font-bold text-gray-900">{badge.name}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{badge.description}</p>
                  {badge.earned_at && (
                    <p className="text-[9px] text-gray-400 mt-1">
                      Earned {new Date(badge.earned_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
