'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Confetti from 'react-confetti';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';


export interface GraduationCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GraduationCelebrationModal({
  isOpen,
  onClose,
}: GraduationCelebrationModalProps) {
  const supabase = getSupabaseBrowserClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (isOpen) {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    }
  }, [isOpen]);

  const handleCelebrate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const res = await fetch(`/api/user/graduate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to convert account');

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  if (!isOpen) return null;

  return (
    <>
      {done && windowSize.width > 0 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.15}
          colors={['#6366f1', '#7c3aed', '#d946ef', '#f59e0b', '#10b981', '#ef4444']}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-sky-100 overflow-hidden animate-fade-in">
          <div className="bg-gradient-to-r from-[#a27f15] via-[#c9a227] to-[#e3c15a] p-6 text-center">
            <div className="text-4xl mb-2">🎓🎉</div>
            <h2 className="text-xl font-bold text-[#0b0e24]">
              You Actually Made It!
            </h2>
          </div>

          <div className="p-6 space-y-4 text-center">
            {done ? (
              <>
                <div className="rounded-xl bg-sky-50 border border-sky-200 p-5">
                  <p className="text-sky-900 font-bold text-lg mb-1">🎊 Alumni Status Activated!</p>
                  <p className="text-sky-700 text-sm">
                    Your account has been converted to <strong>Alumni Status</strong>.
                    You keep all your notes, vault items, and access forever.
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  🏆 You earned the <strong>Alumni</strong> badge — welcome to the alumni community!
                </div>
                <button
                  onClick={onClose}
                  className="w-full rounded-xl bg-gradient-to-r from-sky-700 via-sky-600 to-pink-500 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
                >
                  Go to Dashboard
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-700 leading-relaxed">
                  Your account will be converted to <strong>Alumni Status</strong> so
                  you keep your notes, vault, and access forever. This cannot be undone.
                </p>

                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Not Yet
                  </button>
                  <button
                    onClick={handleCelebrate}
                    disabled={isLoading}
                    className="flex-1 rounded-xl bg-gradient-to-r from-sky-700 via-sky-600 to-pink-500 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {isLoading ? 'Converting...' : '🎉 Yes, I Graduated!'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
