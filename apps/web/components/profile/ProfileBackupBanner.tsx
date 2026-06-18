'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { BackupEmailModal } from '@/components/auth/BackupEmailModal';

export function ProfileBackupBanner() {
  const [hasBackupEmail, setHasBackupEmail] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);
  const supabase = getSupabaseBrowserClient();

  const checkStatus = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${apiBaseUrl}/api/user/backup-status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHasBackupEmail(data.hasBackupEmail);
      }
    } catch {
      // silent
    }
  }, [supabase]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleDismiss = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      await fetch(`${apiBaseUrl}/api/user/dismiss-email-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    }
    setShowModal(false);
  }, [supabase]);

  // Don't render anything if user has backup email or we haven't loaded yet
  if (hasBackupEmail !== false) return null;

  return (
    <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-lg shrink-0 mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Secure your Vault
            </p>
            <p className="text-sm text-amber-800 mt-0.5">
              Link a personal email to keep your files safe.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="shrink-0 rounded-lg bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition-opacity"
          >
            Link Email
          </button>
        </div>
      </div>

      <BackupEmailModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onDismiss={() => {
          setShowModal(false);
          setHasBackupEmail(true);
        }}
        onSuccess={() => {
          setHasBackupEmail(true);
          checkStatus();
        }}
      />
    </>
  );
}
