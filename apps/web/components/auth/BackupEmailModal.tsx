'use client';

import React, { useState, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';


export interface BackupEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onSuccess?: () => void;
}

export function BackupEmailModal({
  isOpen,
  onClose,
  onDismiss,
  onSuccess,
}: BackupEmailModalProps) {
  const supabase = getSupabaseBrowserClient();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleLink = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const res = await fetch(`/api/user/link-backup-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to link email');
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, [email, supabase, onClose, onSuccess]);

  const handleDismiss = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch(`/api/user/dismiss-email-prompt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      }
    } catch {
      // silently fail — dismissal is best-effort
    }
    onDismiss();
    onClose();
  }, [supabase, onDismiss, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-sky-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-400 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              Your Vault is growing! 🚀
            </h2>
            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            Link a personal email (like Gmail) right now so you never lose access to your saved PDFs and internship logs.
          </p>

          {success ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
              <p className="text-emerald-800 font-semibold">
                Email linked successfully! 🎉
              </p>
              <p className="text-emerald-600 text-sm mt-1">
                You earned 50 contribution points.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="backup-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Email
                </label>
                <input
                  id="backup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  disabled={isLoading}
                  className="block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm placeholder-gray-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-gray-500">
                  We will never share your email. Your vault stays private.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleDismiss}
                  disabled={isLoading}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Remind Me Later
                </button>
                <button
                  onClick={handleLink}
                  disabled={isLoading || !email.trim()}
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-400 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isLoading ? 'Linking...' : 'Link Email & Get 50 Points'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
