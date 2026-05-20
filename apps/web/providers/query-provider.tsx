'use client';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from '@/lib/query-client';
import { indexedDBPersister } from '@/lib/indexeddb-persister';
import { AuthProvider } from '@/context/auth-context';
import { LoginModal } from '@/components/auth/LoginModal';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

export function QueryProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: indexedDBPersister }}>
        {children}
        <LoginModal />
        <InstallPrompt />
      </PersistQueryClientProvider>
    </AuthProvider>
  );
}
