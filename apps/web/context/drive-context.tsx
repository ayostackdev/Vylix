'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { authFetch } from '@/lib/auth-fetch';

interface DriveContextType {
  driveConnected: boolean;
  isLoading: boolean;
  driveError: string | null;
  connectDrive: () => Promise<void>;
  disconnectDrive: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  clearError: () => void;
}

const DriveContext = createContext<DriveContextType | undefined>(undefined);

export function DriveProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [driveConnected, setDriveConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [driveError, setDriveError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setDriveConnected(false);
      setIsLoading(false);
      return;
    }
    try {
      const data = await authFetch('/api/google-drive/status') as { connected: boolean };
      setDriveConnected(data.connected);
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
    setDriveError(null);

    try {
      const { auth_url } = await authFetch('/api/google-drive/connect') as { auth_url: string };
      window.location.href = auth_url;
    } catch (err) {
      console.error('Drive connection failed:', err);
      setDriveError('Could not connect to server. Make sure the backend is running.');
    }
  }, []);

  const disconnectDrive = useCallback(async () => {
    try {
      await authFetch('/api/google-drive/disconnect', { method: 'DELETE' });
      setDriveConnected(false);
    } catch (err) {
      console.error('Drive disconnect failed:', err);
    }
  }, []);

  const clearError = useCallback(() => setDriveError(null), []);

  const value: DriveContextType = {
    driveConnected,
    isLoading,
    driveError,
    connectDrive,
    disconnectDrive,
    refreshStatus,
    clearError,
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
