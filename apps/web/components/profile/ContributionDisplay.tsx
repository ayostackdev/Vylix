'use client';

import React, { useState, useEffect } from 'react';
import { useBadges, UserBadgesResponse } from '@/hooks/usePrivacySettings';

export interface ContributionDisplayProps {
  userId: string;
  isOwnProfile?: boolean;
}

interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
}

/**
 * Gamified Contribution Display Component
 * Shows user's badges and contribution score with visual appeal
 */
export function ContributionDisplay({ userId, isOwnProfile = false }: ContributionDisplayProps) {
  const { getUserBadges, isLoading } = useBadges();
  const [badgeData, setBadgeData] = useState<UserBadgesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBadges = async () => {
      const data = await getUserBadges(userId);
      if (data) {
        setBadgeData(data);
      } else {
        setError('Failed to load badges');
      }
    };

    loadBadges();
  }, [userId, getUserBadges]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg text-red-800 text-sm">
        {error}
      </div>
    );
  }

  if (!badgeData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Contribution Score */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg p-6 border-2 border-amber-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">CONTRIBUTION SCORE</p>
            <p className="text-4xl font-bold text-amber-600 mt-2">{badgeData.contributionScore}</p>
            <p className="text-xs text-gray-600 mt-1">
              {badgeData.totalBadges > 0 
                ? `${badgeData.totalBadges} badge${badgeData.totalBadges !== 1 ? 's' : ''} earned`
                : 'Earn badges by contributing'}
            </p>
          </div>
          <div className="text-5xl">🏆</div>
        </div>
      </div>

      {/* Badges Grid */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Your Badges</h3>

        {badgeData.badges.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-600 text-sm">No badges earned yet</p>
            <p className="text-gray-500 text-xs mt-2">
              {isOwnProfile 
                ? 'Share materials or host revision sessions to earn badges!'
                : 'This student is just getting started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {badgeData.badges.map((badge) => (
              <BadgeCard
                key={badge.id}
                badge={badge.badge}
                earnedAt={badge.earnedAt}
              />
            ))}
          </div>
        )}
      </div>

      {/* Badge Info */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-500">
          <p className="font-semibold text-purple-900">🌟 LEGENDARY</p>
          <p className="text-purple-700">100 points</p>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-500">
          <p className="font-semibold text-yellow-900">✨ EPIC</p>
          <p className="text-yellow-700">50 points</p>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
          <p className="font-semibold text-blue-900">💎 RARE</p>
          <p className="text-blue-700">25 points</p>
        </div>
        <div className="bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
          <p className="font-semibold text-green-900">🎁 COMMON</p>
          <p className="text-green-700">10 points</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual Badge Card Component
 */
function BadgeCard({
  badge,
  earnedAt,
}: {
  badge: Badge;
  earnedAt: string;
}) {
  const earnDate = new Date(earnedAt);
  const rarityColors: Record<string, { bg: string; border: string; text: string }> = {
    LEGENDARY: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700' },
    EPIC: { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700' },
    RARE: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
    COMMON: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' },
  };

  const colors = rarityColors[badge.rarity] || rarityColors.COMMON;

  return (
    <div className={`${colors.bg} border-2 ${colors.border} rounded-lg p-4 text-center hover:shadow-lg transition-shadow cursor-pointer group relative`}>
      {/* Badge Image/Icon */}
      <div className="text-4xl mb-2">{badge.icon}</div>

      {/* Badge Name */}
      <p className={`font-bold text-sm ${colors.text} line-clamp-2`}>{badge.name}</p>

      {/* Rarity Badge */}
      <p className={`text-xs font-semibold ${colors.text} mt-1`}>{badge.rarity}</p>

      {/* Tooltip on Hover */}
      <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
        {badge.description}
      </div>

      {/* Earned Date */}
      <p className="text-xs opacity-60 mt-2">
        {earnDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </p>
    </div>
  );
}

/**
 * Leaderboard Component
 */
interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    fullName: string;
    matricNumber: string;
    contributionScore: number;
    avatarUrl: string | null;
    badges: Array<{ id: string; badge: Badge; earnedAt: string }>;
    college: { code: string; name: string };
    department: { code: string; name: string };
  };
}

export function ContributionLeaderboard() {
  const { getLeaderboard, isLoading } = useBadges();
  const [leaderboard, setLeaderboard] = useState<{ total: number; leaderboard: LeaderboardEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLeaderboard = async () => {
      const data = await getLeaderboard();
      if (data) {
        setLeaderboard(data);
      } else {
        setError('Failed to load leaderboard');
      }
    };

    loadLeaderboard();
  }, [getLeaderboard]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg text-red-800 text-sm">
        {error}
      </div>
    );
  }

  if (!leaderboard) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-bold text-gray-900">🏆 Top Contributors</h3>

      <div className="space-y-2">
        {leaderboard.leaderboard.map((entry: LeaderboardEntry, idx: number) => (
          <div
            key={entry.user.id}
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg hover:shadow-md transition-shadow"
          >
            {/* Rank */}
            <div className="flex-shrink-0">
              {idx === 0 && <span className="text-3xl">🥇</span>}
              {idx === 1 && <span className="text-3xl">🥈</span>}
              {idx === 2 && <span className="text-3xl">🥉</span>}
              {idx > 2 && (
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center font-bold text-white">
                  {entry.rank}
                </div>
              )}
            </div>

            {/* Avatar */}
            <img
              src={entry.user.avatarUrl || `https://via.placeholder.com/40?text=${entry.user.fullName.charAt(0)}`}
              alt={entry.user.fullName}
              className="w-10 h-10 rounded-full"
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{entry.user.fullName}</p>
              <p className="text-xs text-gray-600">{entry.user.college?.code}</p>
            </div>

            {/* Score */}
            <div className="text-right">
              <p className="text-lg font-bold text-blue-600">{entry.user.contributionScore}</p>
              <p className="text-xs text-gray-500">{entry.user.badges?.length || 0} badges</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
