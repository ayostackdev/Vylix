'use client';

import React, { useState, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { isUniversityEmail } from '@/context/progressive-gating-context';


export interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export function EmailVerificationModal({
  isOpen,
  onClose,
  onVerified,
}: EmailVerificationModalProps) {
  const supabase = getSupabaseBrowserClient();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');

  const handleSubmit = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (!isUniversityEmail(trimmed)) {
      setError('Please use your official university email (.edu.ng, .edu, etc.)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const res = await fetch(`/api/user/school-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to save email');
      }

      setSuccess(true);
      setTimeout(() => {
        onVerified();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, [email, supabase, onVerified]);

  const handleVerifyWithOtp = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();

    setIsLoading(true);
    setError(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: false },
      });

      if (otpError) throw otpError;
      setShowOtp(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setIsLoading(false);
    }
  }, [email, supabase]);

  const handleConfirmOtp = useCallback(async () => {
    if (!otp || otp.length < 4) {
      setError('Please enter the full verification code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const trimmed = email.trim().toLowerCase();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: trimmed,
        token: otp,
        type: 'email',
      });

      if (verifyError) throw verifyError;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      await fetch(`/api/user/school-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: trimmed }),
      });

      setSuccess(true);
      setTimeout(() => {
        onVerified();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code');
    } finally {
      setIsLoading(false);
    }
  }, [otp, email, supabase, onVerified]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-amber-100 overflow-hidden animate-fade-in">
        <div className="bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              🎓 Unlock the Vault
            </h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            We need your official university email to verify your student status and unlock downloads, notes, and more.
          </p>

          {success ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
              <p className="text-emerald-800 font-semibold text-lg">Email Saved! 🎉</p>
              <p className="text-emerald-600 text-sm mt-1">Your university email has been confirmed.</p>
            </div>
          ) : showOtp ? (
            <>
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                A verification code was sent to <strong>{email}</strong>. Enter it below.
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="otp-code" className="block text-sm font-medium text-gray-700 mb-1">
                  Verification Code
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  disabled={isLoading}
                  className="block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-center tracking-[0.3em] font-mono placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-50"
                />
              </div>

              <button
                onClick={handleConfirmOtp}
                disabled={isLoading || otp.length < 4}
                className="w-full rounded-xl bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isLoading ? 'Verifying...' : 'Confirm Code'}
              </button>
            </>
          ) : (
            <>
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="school-email" className="block text-sm font-medium text-gray-700 mb-1">
                  University Email
                </label>
                <input
                  id="school-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@student.university.edu.ng"
                  disabled={isLoading}
                  className="block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Must be an official university email address.
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isLoading || !email.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isLoading ? 'Saving...' : 'Verify & Unlock'}
              </button>

              <button
                onClick={handleVerifyWithOtp}
                disabled={isLoading || !email.trim()}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
              >
                Need to verify with a code instead?
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
