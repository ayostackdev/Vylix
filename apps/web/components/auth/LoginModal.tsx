'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/auth-context';

export function LoginModal() {
  const { showLoginModal, setShowLoginModal, login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      const result = await login(email, password, isSignUp);
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  if (!showLoginModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-green-100">
        {/* Header */}
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-emerald-50/35 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[clamp(1.5rem,3vw,2.2rem)] leading-[1.2] tracking-[-0.03em] font-black bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent mb-3">
                {isSignUp ? 'Join Vylix' : 'Welcome Back'}
              </h2>
              <p className="cp-body mt-1 text-sm">
                {isSignUp
                  ? 'Create account to contribute'
                  : 'Sign in to upload & participate'}
              </p>
            </div>
            <button
              onClick={() => setShowLoginModal(false)}
              className="text-2xl text-gray-500 hover:text-gray-700 transition-colors"
              title="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 border border-red-200 font-medium">
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-gradient-to-br from-blue-50 to-emerald-50/35 p-3 text-sm text-green-800 border border-blue-100 font-medium">
              {success}
            </div>
          )}

          {/* Email Input */}
          <div>
            <label className="cp-label block mb-2 text-gray-900">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@funaab.edu.ng"
              className="w-full rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              disabled={isLoading}
            />
            {isSignUp && (
              <p className="mt-1 text-xs text-gray-600">
                Use your FUNAAB institutional email
              </p>
            )}
          </div>

          {/* Password Input */}
          <div>
            <label className="cp-label block mb-2 text-gray-900">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              disabled={isLoading}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 py-2.5 font-bold text-white transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? 'Processing...'
              : isSignUp
                ? 'Create Account'
                : 'Sign In'}
          </button>

          {/* Toggle Sign Up / Sign In */}
          <div className="border-t border-blue-100 pt-4 text-center">
            <p className="cp-body text-sm">
              {isSignUp
                ? 'Already have an account? '
                : "Don't have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setSuccess('');
                }}
                className="font-semibold text-transparent bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text hover:opacity-80 transition-opacity"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </form>

        {/* Info Box */}
        <div className="border-t border-blue-100 bg-gradient-to-r from-blue-50 to-emerald-50/35 px-6 py-4">
          <p className="text-xs text-gray-700">
            <strong>Registration Required:</strong> You can browse materials and posts
            without signing in, but you'll need to register to upload, comment, or participate.
          </p>
        </div>
      </div>
    </div>
  );
}
