'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

interface User {
  id: string;
  email: string;
  fullName: string;
}

interface AuthActionResult {
  success: boolean;
  message: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, isSignUp?: boolean) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  promptLogin: (action: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabaseClient = getSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const { data } = await supabaseClient.auth.getSession();
      const sessionUser = data.session?.user;

      if (!isMounted) {
        return;
      }

      if (sessionUser) {
        setUser({
          id: sessionUser.id,
          email: sessionUser.email ?? '',
          fullName:
            sessionUser.user_metadata?.full_name ??
            sessionUser.user_metadata?.name ??
            sessionUser.email?.split('@')[0] ??
            'Student',
        });
      } else {
        setUser(null);
      }

      setIsLoading(false);
    };

    syncSession();

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, currentSession) => {
      const sessionUser = currentSession?.user;

      if (!isMounted) {
        return;
      }

      if (sessionUser) {
        setUser({
          id: sessionUser.id,
          email: sessionUser.email ?? '',
          fullName:
            sessionUser.user_metadata?.full_name ??
            sessionUser.user_metadata?.name ??
            sessionUser.email?.split('@')[0] ??
            'Student',
        });
      } else {
        setUser(null);
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabaseClient]);

  const login = useCallback(async (email: string, password: string, isSignUp = false): Promise<AuthActionResult> => {
    setIsLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split('@')[0],
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.session?.user) {
          setUser({
            id: data.session.user.id,
            email: data.session.user.email ?? email,
            fullName:
              data.session.user.user_metadata?.full_name ??
              data.session.user.user_metadata?.name ??
              email.split('@')[0],
          });
          setShowLoginModal(false);
          return {
            success: true,
            message: 'Account created and signed in successfully.',
          };
        }

        return {
          success: true,
          message: 'Account created. Check your email to confirm your sign up.',
        };
      }

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email ?? email,
          fullName:
            data.user.user_metadata?.full_name ??
            data.user.user_metadata?.name ??
            email.split('@')[0],
        });
      }

      setShowLoginModal(false);
      return {
        success: true,
        message: 'Signed in successfully.',
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [supabaseClient]);

  const logout = useCallback(async () => {
    await supabaseClient.auth.signOut();
    setUser(null);
  }, [supabaseClient]);

  const promptLogin = useCallback((action: string) => {
    setPendingAction(action);
    setShowLoginModal(true);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    showLoginModal,
    setShowLoginModal,
    promptLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
