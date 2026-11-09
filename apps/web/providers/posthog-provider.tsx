'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { identifyPostHogUser, initPostHog, resetPostHogUser } from '@/lib/posthog';

/**
 * Must live inside AuthProvider so signed-in users can be identified.
 * Only pseudonymous, non-sensitive traits are attached (no email/name).
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (user) {
      identifyPostHogUser(user.id, {
        status: user.status,
        role: user.role,
        department_code: user.departmentCode,
        entry_year: user.entryYear,
      });
    } else {
      resetPostHogUser();
    }
  }, [user]);

  return <>{children}</>;
}
