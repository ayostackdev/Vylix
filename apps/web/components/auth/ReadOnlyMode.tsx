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
    <div className="flex flex-col gap-4 rounded-[1.5rem] border border-blue-100 bg-gradient-to-br from-blue-50 to-emerald-50/60 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="cp-card-title text-gray-900">🔓 Sign in to {action}</p>
        <p className="cp-body mt-1 text-sm">
          You're browsing in read-only mode. Create an account to contribute and access full features.
        </p>
      </div>
      <button
        onClick={() => promptLogin(action)}
        className="flex-shrink-0 self-start whitespace-nowrap rounded-full border border-blue-100 bg-blue-100 px-4 py-2.5 font-black text-sky-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-200 hover:shadow-md sm:self-auto"
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
