'use client';

import React, { useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { useProgressiveGating } from '@/context/progressive-gating-context';
import { useAuth } from '@/context/auth-context';


const RE_PROMPT_DAYS = 7;

function shouldShowBanner(dismissedAt: string | undefined): boolean {
  if (!dismissedAt) return true;
  const diff = Date.now() - new Date(dismissedAt).getTime();
  return diff > RE_PROMPT_DAYS * 24 * 60 * 60 * 1000;
}

export function SchoolEmailBanner() {
  const supabase = getSupabaseBrowserClient();
  const { user } = useAuth();
  const { openEmailModal } = useProgressiveGating();

  const handleDismiss = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetch(`/api/user/dismiss-school-email-prompt`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      }).catch(() => {});
    }
    window.location.reload();
  }, [supabase]);

  if (user?.schoolEmail) return null;
  if (!shouldShowBanner(user?.schoolEmailPromptDismissedAt)) return null;

  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50/60 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="cp-card-title text-amber-900">🔐 Verify your university email</p>
        <p className="cp-body mt-1 text-sm text-amber-800">
          Unlock downloads, posting, and full access by adding your official university email.
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={handleDismiss}
          className="whitespace-nowrap rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors"
        >
          Remind in {RE_PROMPT_DAYS} days
        </button>
        <button
          onClick={openEmailModal}
          className="whitespace-nowrap rounded-full bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-sm"
        >
          Add Email
        </button>
      </div>
    </div>
  );
}
