'use client';

import React from 'react';
import { useAuth } from '@/context/auth-context';

interface ReadOnlyBannerProps {
  action: string;
}

/**
 * Banner shown to unauthenticated users when they try to access a feature
 */
export function ReadOnlyBanner({ action }: ReadOnlyBannerProps) {
  const { promptLogin } = useAuth();

  return (
    <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-blue-950">🔓 Sign in to {action}</p>
        <p className="text-sm text-slate-800 mt-1">
          You're browsing in read-only mode. Create an account to contribute and access full features.
        </p>
      </div>
      <button
        onClick={() => promptLogin(action)}
        className="flex-shrink-0 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold transition-colors whitespace-nowrap hover:shadow-lg hover:shadow-green-400/50"
      >
        Sign In Now
      </button>
    </div>
  );
}

/**
 * Wrapper component that shows content with a read-only indicator for non-authenticated users
 */
export function ReadOnlyWrapper({
  children,
  isReadOnly,
  action,
}: {
  children: React.ReactNode;
  isReadOnly?: boolean;
  action?: string;
}) {
  const { isAuthenticated } = useAuth();
  const showReadOnly = isReadOnly && !isAuthenticated;

  return (
    <div className={showReadOnly ? 'pointer-events-none opacity-60' : ''}>
      {showReadOnly && action && (
        <div className="mb-4">
          <ReadOnlyBanner action={action} />
        </div>
      )}
      {children}
    </div>
  );
}
