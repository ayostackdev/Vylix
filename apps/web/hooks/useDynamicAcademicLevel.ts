'use client';

import { useMemo } from 'react';

/**
 * Calculates current academic level based on entry year
 * FUNAAB academic sessions start in August/September each year
 * 
 * Example:
 * - Entry year: 2021
 * - Current date: March 2024
 * - Current session: 2023 (since August/Sept haven't passed yet)
 * - Elapsed: 2023 - 2021 = 2 years
 * - Current level: 200L (second year)
 */
export function useDynamicAcademicLevel(entryYear: number) {
  const currentLevel = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    // Academic session starts in August (month 7)
    // If we're before August, the current session is the previous year
    const currentAcademicSession = currentMonth >= 7 ? currentYear : currentYear - 1;

    // Calculate years elapsed
    const yearsElapsed = currentAcademicSession - entryYear;

    // Calculate level (100L, 200L, 300L, 400L, 500L)
    // Ensure it's at least 100L and doesn't exceed 500L
    const level = Math.max(100, Math.min(500, (yearsElapsed + 1) * 100));

    return {
      level,
      levelDisplay: `${level}L`,
      yearsElapsed,
      currentAcademicSession,
      isGraduated: yearsElapsed >= 5, // Most programs are 4-5 years
    };
  }, [entryYear]);

  return currentLevel;
}

/**
 * Formats academic level for display
 */
export function formatAcademicLevel(level: number): string {
  switch (level) {
    case 100:
      return '100L (Freshman)';
    case 200:
      return '200L (Sophomore)';
    case 300:
      return '300L (Junior)';
    case 400:
      return '400L (Senior)';
    case 500:
      return '500L (Final Year)';
    default:
      return `${level}L`;
  }
}

/**
 * Gets the level name based on numeric level
 */
export function getAcademicLevelName(level: number): string {
  switch (level) {
    case 100:
      return 'Freshman';
    case 200:
      return 'Sophomore';
    case 300:
      return 'Junior';
    case 400:
      return 'Senior';
    case 500:
      return 'Final Year';
    default:
      return 'Student';
  }
}

/**
 * Gets color for level badge
 */
export function getLevelColor(level: number): string {
  switch (level) {
    case 100:
      return 'bg-blue-100 text-blue-800';
    case 200:
      return 'bg-green-100 text-green-800';
    case 300:
      return 'bg-yellow-100 text-yellow-800';
    case 400:
      return 'bg-orange-100 text-orange-800';
    case 500:
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
