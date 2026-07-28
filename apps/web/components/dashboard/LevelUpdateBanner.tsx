'use client';

import React, { useState, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { useAuth } from '@/context/auth-context';
import { useProgressiveGating, isInCurrentSession } from '@/context/progressive-gating-context';


const LEVELS = ['100L', '200L', '300L', '400L', '500L', 'Spillover'] as const;

export function LevelUpdateBanner() {
  const supabase = getSupabaseBrowserClient();
  const { user } = useAuth();
  const { openGraduationModal } = useProgressiveGating();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = useCallback(async (level: string) => {
    if (level === "I've Graduated! 🎓") {
      openGraduationModal();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const res = await fetch(`/api/user/update-level`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ level }),
      });

      if (!res.ok) throw new Error('Failed to update level');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, openGraduationModal]);

  const hasCurrentSessionLevel = isInCurrentSession(user?.levelUpdatedAt);
  if (!user || user.status !== 'STUDENT' || hasCurrentSessionLevel) return null;

  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50/50 p-5 shadow-sm animate-fade-in">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🚀</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-gray-900 text-base">
            Welcome to a New Session!
          </h3>
          <p className="text-sm text-gray-600 mt-0.5">
            What level are you rocking this year?
          </p>

          {error && (
            <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                onClick={() => handleSelect(lvl)}
                disabled={isLoading}
                className="rounded-full px-4 py-2 text-sm font-semibold transition-all border bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
              >
                {lvl}
              </button>
            ))}
            <button
              onClick={() => handleSelect("I've Graduated! 🎓")}
              disabled={isLoading}
              className="rounded-full px-4 py-2 text-sm font-semibold border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-all disabled:opacity-50"
            >
              I've Graduated! 🎓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
