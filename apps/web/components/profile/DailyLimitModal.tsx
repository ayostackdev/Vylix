'use client';

import { useEffect } from 'react';

interface DailyLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DailyLimitModal({ isOpen, onClose }: DailyLimitModalProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = '' };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚡</span>
        </div>

        <h2 className="text-base font-bold text-gray-900 mb-1">Daily AI Limit Reached</h2>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          You&apos;ve used all your free AI queries for today. Upgrade to Premium for <strong>100 AI queries/day</strong> and unlock the full power of Vylix.
        </p>

        <div className="space-y-2">
          <a
            href="/pricing"
            className="block w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm hover:shadow-lg transition-all"
          >
            Upgrade to Premium — #2,500/yr
          </a>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium text-xs hover:bg-gray-200 transition-all"
          >
            Maybe Later
          </button>
        </div>

        <p className="text-[10px] text-gray-400 mt-4">
          Free tier: 15 AI queries/day &middot; Resets at midnight
        </p>
      </div>
    </div>
  );
}
