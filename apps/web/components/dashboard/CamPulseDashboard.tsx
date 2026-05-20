'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PrivateVaultView } from '@/components/dashboard/PrivateVaultView';
import { PublicPulseView } from '@/components/dashboard/PublicPulseView';
import { useNetworkState } from '@/hooks/useNetworkState';
import { useAuth } from '@/context/auth-context';
import { ReadOnlyBanner } from '@/components/auth/ReadOnlyMode';

export function CamPulseDashboard() {
  const [activeLayer, setActiveLayer] = useState<'vault' | 'pulse'>('pulse');
  const { isOnline } = useNetworkState();
  const { isAuthenticated, promptLogin } = useAuth();
  const userInitials = 'CS';

  useEffect(() => {
    if (!isOnline && activeLayer === 'pulse') {
      setActiveLayer('vault');
    }
  }, [isOnline, activeLayer]);

  const handleVaultClick = () => {
    if (!isAuthenticated) {
      promptLogin('access your Private Vault');
    } else {
      setActiveLayer('vault');
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-y-auto overflow-x-hidden px-2 py-2 text-slate-800 sm:px-4 sm:py-4 md:px-8 md:py-8 lg:px-12 lg:py-10">
      <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-blue-200/40 blur-2xl" />
      <div className="pointer-events-none absolute -right-16 top-1/4 h-96 w-96 rounded-full bg-green-200/20 blur-2xl" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-3 overflow-visible md:gap-6">
        <div className="flex flex-col space-y-3 rounded-3xl border border-blue-200/80 bg-white/80 p-3 shadow-lg shadow-blue-200/20 backdrop-blur-xl sm:space-y-4 sm:p-4 md:p-5">
          <header className="animate-[fadeIn_420ms_ease-out] flex flex-col gap-4 rounded-2xl border border-blue-200 bg-white/70 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:p-5 md:p-6">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-800">
                FUNAAB ACADEMIC OS
              </p>
              <h1 className="text-3xl font-black tracking-tight text-blue-950 sm:text-5xl md:text-6xl">CamPulse</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-bold">
                  {isAuthenticated ? 'Private + Public Learning' : 'Browse Public Content'}
                </span>
                {!isOnline ? (
                  <Badge variant="destructive" className="px-3 py-1 text-[10px]">
                    Offline Mode Active
                  </Badge>
                ) : isAuthenticated ? (
                  <Badge variant="success" className="px-3 py-1 text-[10px]">Live & Connected</Badge>
                ) : (
                  <Badge variant="default" className="px-3 py-1 text-[10px]">Browse Only</Badge>
                )}
              </div>
            </div>

            <Avatar className="h-11 w-11 border-2 border-blue-200 shadow-sm transition-all duration-300 hover:scale-110 sm:h-14 sm:w-14 md:h-16 md:w-16 ring-2 ring-blue-100">
              <AvatarImage src="/avatars/student-profile.jpg" alt="Student profile photo" />
              <AvatarFallback className="bg-blue-50 font-black text-blue-950">{userInitials}</AvatarFallback>
            </Avatar>
          </header>

          {!isAuthenticated && (
            <ReadOnlyBanner action="upload materials and access full features" />
          )}

          <Tabs
            value={activeLayer}
            onValueChange={(val) => {
              if (val === 'vault' && !isAuthenticated) {
                promptLogin('access your Private Vault');
              } else {
                setActiveLayer(val as 'vault' | 'pulse');
              }
            }}
            className="cp-fade-up flex flex-col gap-3 sm:gap-4"
          >
            <div className="flex w-full justify-center">
              <TabsList className="grid w-full max-w-none grid-cols-2 rounded-xl border border-blue-200 bg-white/90 p-1 shadow-lg shadow-blue-200/30 backdrop-blur-xl sm:max-w-xl sm:rounded-2xl sm:p-1.5">
                <TabsTrigger
                  value="vault"
                  className="rounded-lg px-2 py-2 text-[11px] font-black uppercase tracking-wide text-slate-800 transition-all data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md disabled:opacity-40 sm:px-3 sm:py-2.5 sm:text-sm sm:tracking-widest"
                  disabled={!isAuthenticated}
                >
                  🔐 Private Vault {!isAuthenticated && <span className="ml-1">🔒</span>}
                </TabsTrigger>
                <TabsTrigger
                  value="pulse"
                  disabled={!isOnline}
                  className="rounded-lg px-2 py-2 text-[11px] font-black uppercase tracking-wide text-slate-800 transition-all data-[state=active]:bg-green-500 data-[state=active]:text-white data-[state=active]:shadow-md disabled:opacity-40 sm:px-3 sm:py-2.5 sm:text-sm sm:tracking-widest"
                >
                  ✨ Public Pulse
                </TabsTrigger>
              </TabsList>
            </div>

            <section className="rounded-3xl border border-blue-200 bg-white/70 shadow-sm backdrop-blur-xl">
              <ScrollArea className="w-full">
                <div className="flex flex-col">
                  <TabsContent value="vault" className="cp-fade-up m-0 p-3 sm:p-6 lg:p-8">
                    {!isAuthenticated ? (
                      <div className="text-center py-12">
                        <p className="text-4xl mb-4">🔒</p>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Private Vault Locked</h3>
                        <p className="text-gray-600 mb-6">
                          Sign in to access your encrypted document vault and store PDFs offline.
                        </p>
                        <button
                          onClick={() => promptLogin('access your Private Vault')}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                        >
                          Sign In to Access Vault
                        </button>
                      </div>
                    ) : (
                      <PrivateVaultView />
                    )}
                  </TabsContent>

                  <TabsContent value="pulse" className="cp-fade-up m-0 p-3 sm:p-6 lg:p-8">
                    <PublicPulseView isReadOnly={!isAuthenticated} />
                  </TabsContent>

                  <footer className="border-t border-blue-200/80 bg-white/40 px-3 py-2 backdrop-blur-md sm:px-6 sm:py-3">
                    <div className="flex items-center justify-between gap-3 text-left">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-blue-800 sm:text-[10px]">
                          CamPulse Academic OS
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-800 sm:text-xs">
                          © 2026 FUNAAB
                        </p>
                      </div>

                      <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-2 py-1 shadow-sm">
                        <span className={`h-2 w-2 rounded-full shadow-[0_0_0_4px_rgba(34,197,94,0.12)]`}
                          style={{ backgroundColor: isAuthenticated ? '#22c55e' : '#94a3b8' }}
                        />
                        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-blue-950 sm:text-[10px]">
                          {isAuthenticated ? 'Authenticated' : 'Guest'}
                        </span>
                      </div>
                    </div>
                  </footer>
                </div>
              </ScrollArea>
            </section>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
