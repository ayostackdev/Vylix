'use client';

import { useMemo } from 'react';

export interface AcademicLevelResult {
  level: number;
  levelDisplay: string;
  yearsElapsed: number;
  currentAcademicSession: number;
  isAlumni: boolean;
  status: 'STUDENT' | 'ALUMNI';
}

export function useDynamicAcademicLevel(
  entryYear: number,
  collegeDurationYears: number = 4
): AcademicLevelResult {
  const result = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const currentAcademicSession = currentMonth >= 7 ? currentYear : currentYear - 1;
    const yearsElapsed = currentAcademicSession - entryYear;
    const isAlumni = yearsElapsed + 1 > collegeDurationYears;

    const level = isAlumni
      ? 500
      : Math.max(100, Math.min(500, (yearsElapsed + 1) * 100));

    return {
      level,
      levelDisplay: isAlumni ? 'Alumni' : `${level}L`,
      yearsElapsed,
      currentAcademicSession,
      isAlumni,
      status: isAlumni ? 'ALUMNI' as const : 'STUDENT' as const,
    };
  }, [entryYear, collegeDurationYears]);

  return result;
}

export function formatAcademicLevel(level: number, isAlumni?: boolean): string {
  if (isAlumni) return 'Alumni';
  switch (level) {
    case 100: return '100L (Freshman)';
    case 200: return '200L (Sophomore)';
    case 300: return '300L (Junior)';
    case 400: return '400L (Senior)';
    case 500: return '500L (Final Year)';
    default:  return `${level}L`;
  }
}

export function getAcademicLevelName(level: number, isAlumni?: boolean): string {
  if (isAlumni) return 'Alumni';
  switch (level) {
    case 100: return 'Freshman';
    case 200: return 'Sophomore';
    case 300: return 'Junior';
    case 400: return 'Senior';
    case 500: return 'Final Year';
    default:  return 'Student';
  }
}

export function getLevelColor(level: number, isAlumni?: boolean): string {
  if (isAlumni) return 'bg-purple-100 text-purple-800';
  switch (level) {
    case 100: return 'bg-blue-100 text-blue-800';
    case 200: return 'bg-green-100 text-green-800';
    case 300: return 'bg-yellow-100 text-yellow-800';
    case 400: return 'bg-orange-100 text-orange-800';
    case 500: return 'bg-red-100 text-red-800';
    default:  return 'bg-gray-100 text-gray-800';
  }
}
