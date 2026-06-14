import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { getVaultMaterials } from '@/lib/vault-store';

const MILESTONES = [3, 8, 15, 25];

function getNextMilestone(currentCount: number): number | null {
  return MILESTONES.find((m) => m > currentCount) ?? null;
}

function shouldPrompt(
  vaultCount: number,
  hasBackupEmail: boolean,
  dismissedAt: string | null
): boolean {
  if (hasBackupEmail) return false;
  if (vaultCount < 3) return false;

  if (!dismissedAt) return vaultCount >= 3;

  const daysSince = Math.floor(
    (Date.now() - new Date(dismissedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSince < 14) return false;

  const milestone = getNextMilestone(vaultCount - 1);
  return milestone !== null && vaultCount >= milestone;
}

interface BackupStatus {
  hasBackupEmail: boolean;
  emailPromptDismissedAt: string | null;
  vaultCount: number;
  shouldPrompt: boolean;
  nextMilestone: number | null;
}

export function useBackupEmailPrompt() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/user/backup-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data: BackupStatus = await res.json();
        setStatus(data);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  /**
   * Call this after every "Save to Vault" action.
   * It checks the rule-of-3 (and subsequent milestones) and opens the modal if needed.
   */
  const checkAfterSave = useCallback(async () => {
    const vaultMaterials = await getVaultMaterials();
    const vaultCount = vaultMaterials.length;

    if (!status) return;

    const { hasBackupEmail, emailPromptDismissedAt } = status;

    if (shouldPrompt(vaultCount, hasBackupEmail, emailPromptDismissedAt)) {
      setShowModal(true);
    }
  }, [status]);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleDismissed = useCallback(() => {
    setStatus((prev) =>
      prev
        ? { ...prev, emailPromptDismissedAt: new Date().toISOString() }
        : prev
    );
  }, []);

  const handleSuccess = useCallback(() => {
    setStatus((prev) =>
      prev ? { ...prev, hasBackupEmail: true } : prev
    );
    fetchStatus();
  }, [fetchStatus]);

  return {
    showModal,
    isLoading,
    status,
    checkAfterSave,
    closeModal,
    handleDismissed,
    handleSuccess,
    fetchStatus,
  };
}
