'use client';

import React from 'react';
import { useAuth } from '@/context/auth-context';

interface ReadOnlyBannerProps {
  action: string;
}

export function ReadOnlyBanner({ action }: ReadOnlyBannerProps) {
  const { promptLogin } = useAuth();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100/60 bg-white/70 backdrop-blur-xl shadow-sm shadow-indigo-600/5">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/[0.03] via-violet-600/[0.02] to-violet-600/[0.03]" />
      <div className="relative flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
          <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-900 tracking-tight leading-tight">
            Read-Only Mode
          </p>
          <p className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5 hidden sm:block">
            Sign in to {action}
          </p>
        </div>
        <button
          onClick={() => promptLogin(action)}
          className="flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] sm:text-xs px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          Sign In
        </button>
      </div>
    </div>
  );
}

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
