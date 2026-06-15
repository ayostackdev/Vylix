'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { useAuth } from '@/context/auth-context';

const UNIVERSITY_DOMAINS = ['.edu.ng', '.ac.ke', '.edu', '.ac.ug', '.ac.tz', '.ac.za'];

export function isUniversityEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return UNIVERSITY_DOMAINS.some((d) => domain.endsWith(d));
}

export function getCurrentAcademicSession(): number {
  const now = new Date();
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

export function isInCurrentSession(date: Date | string | undefined | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  const session = getCurrentAcademicSession();
  const year = d.getFullYear();
  const month = d.getMonth();
  const itemSession = month >= 8 ? year : year - 1;
  return itemSession === session;
}

interface GatingState {
  showEmailModal: boolean;
  showGraduationModal: boolean;
}

interface ProgressiveGatingContextType extends GatingState {
  gate: (action: string, onSuccess?: () => void) => Promise<boolean>;
  openEmailModal: () => void;
  closeEmailModal: () => void;
  onEmailVerified: () => void;
  openGraduationModal: () => void;
  closeGraduationModal: () => void;
}

const ProgressiveGatingContext = createContext<ProgressiveGatingContextType | undefined>(undefined);

export function ProgressiveGatingProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, promptLogin, setShowLoginModal } = useAuth();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showGraduationModal, setShowGraduationModal] = useState(false);
  const [pendingGateCallback, setPendingGateCallback] = useState<(() => void) | null>(null);

  const openEmailModal = useCallback(() => setShowEmailModal(true), []);
  const closeEmailModal = useCallback(() => setShowEmailModal(false), []);
  const openGraduationModal = useCallback(() => setShowGraduationModal(true), []);
  const closeGraduationModal = useCallback(() => setShowGraduationModal(false), []);

  const onEmailVerified = useCallback(() => {
    setShowEmailModal(false);
    const cb = pendingGateCallback;
    setPendingGateCallback(null);
    cb?.();
  }, [pendingGateCallback]);

  const gate = useCallback(async (action: string, onSuccess?: () => void): Promise<boolean> => {
    if (!isAuthenticated) {
      promptLogin(action);
      return false;
    }

    if (user?.status === 'ALUMNI') return false;

    if (!user?.schoolEmail) {
      setPendingGateCallback(() => onSuccess ?? null);
      setShowEmailModal(true);
      return false;
    }

    onSuccess?.();
    return true;
  }, [isAuthenticated, promptLogin, user?.status, user?.schoolEmail]);

  const value: ProgressiveGatingContextType = {
    showEmailModal,
    showGraduationModal,
    gate,
    openEmailModal,
    closeEmailModal,
    onEmailVerified,
    openGraduationModal,
    closeGraduationModal,
  };

  return (
    <ProgressiveGatingContext.Provider value={value}>
      {children}
    </ProgressiveGatingContext.Provider>
  );
}

export function useProgressiveGating() {
  const context = useContext(ProgressiveGatingContext);
  if (context === undefined) {
    throw new Error('useProgressiveGating must be used within ProgressiveGatingProvider');
  }
  return context;
}
