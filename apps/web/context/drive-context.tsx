'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface DriveContextType {
  driveConnected: boolean;
  isLoading: boolean;
  connectDrive: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const DriveContext = createContext<DriveContextType | undefined>(undefined);

export function DriveProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [driveConnected, setDriveConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setDriveConnected(false);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/google-drive/status`);
      if (res.ok) {
        const data = await res.json();
        setDriveConnected(data.connected);
      }
    } catch {
      setDriveConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const connectDrive = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`${API_BASE}/api/google-drive/connect`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) throw new Error('Failed to start Drive connection');
    const { auth_url } = await res.json();
    window.location.href = auth_url;
  }, []);

  const value: DriveContextType = {
    driveConnected,
    isLoading,
    connectDrive,
    refreshStatus,
  };

  return <DriveContext.Provider value={value}>{children}</DriveContext.Provider>;
}

export function useDrive() {
  const context = useContext(DriveContext);
  if (context === undefined) {
    throw new Error('useDrive must be used within DriveProvider');
  }
  return context;
}
