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
  const spotlightStats = [
    { label: 'Vault readiness', value: isAuthenticated ? 'Unlocked' : 'Preview' },
    { label: 'Pulse mode', value: isOnline ? 'Live' : 'Offline' },
    { label: 'Identity', value: isAuthenticated ? 'Synced' : 'Guest' },
  ];

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
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden overflow-y-auto px-3 py-3 text-gray-700 sm:px-4 sm:py-4 md:px-8 md:py-8 lg:px-12 lg:py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-200/35 blur-2xl cp-float" />
      <div className="pointer-events-none absolute right-[-5rem] top-24 h-[28rem] w-[28rem] rounded-full bg-green-200/28 blur-2xl cp-shimmer" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/50 to-transparent" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-1 min-h-0 flex-col gap-3 overflow-visible md:gap-6">
        <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-[2rem] border border-blue-100 bg-blue-50/95 p-4 shadow-[0_24px_80px_rgba(148,163,184,0.14)] sm:gap-5 sm:p-5 md:p-6 lg:p-7">
          <div className="sticky top-3 z-30 grid gap-4 rounded-[1.9rem] border border-blue-100 bg-blue-50/95 p-3 shadow-[0_18px_45px_rgba(59,130,246,0.08)] backdrop-blur-sm lg:grid-cols-[1.45fr_0.9fr] lg:p-4">
            <header className="cp-fade-up relative overflow-hidden rounded-[1.75rem] border border-blue-100 bg-white/95 p-5 shadow-[0_16px_40px_rgba(59,130,246,0.08)] backdrop-blur-sm sm:p-6 md:p-7 lg:p-8">
              <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-blue-200/25 blur-2xl" />
              <div className="pointer-events-none absolute bottom-[-3rem] right-12 h-28 w-28 rounded-full bg-green-200/30 blur-2xl" />

              <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0 space-y-4">
                  <div className="cp-pill inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-gray-700 shadow-sm">
                    FUNAAB Academic OS
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Premium edition
                  </div>

                  <div className="space-y-2">
                    <h1 className="cp-title font-black text-gray-900">
                      CamPulse
                    </h1>
                    <p className="cp-body max-w-2xl sm:text-base">
                      A polished academic workspace that keeps your vault, pulse feed, and student identity in one calm, fast place.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 font-semibold text-green-700 shadow-sm">
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

                <div className="flex items-center gap-4 rounded-[1.5rem] border border-blue-100 bg-blue-50 px-4 py-3 shadow-sm">
                    <Avatar className="h-14 w-14 border-2 border-green-200 shadow-sm ring-4 ring-green-50 sm:h-16 sm:w-16">
                    <AvatarImage src="/avatars/student-profile.jpg" alt="Student profile photo" />
                    <AvatarFallback className="bg-green-50 font-black text-gray-900">{userInitials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="cp-label">Student profile</p>
                    <p className="mt-1 cp-card-title text-gray-900">Campus identity</p>
                    <p className="cp-body text-sm">Clean, secure, and continuity-first</p>
                  </div>
                </div>
              </div>
            </header>

            <aside className="cp-fade-up grid gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:gap-4">
              {spotlightStats.map((stat, index) => (
                <article
                  key={stat.label}
                  className="rounded-[1.5rem] border border-blue-100 bg-white p-4 shadow-[0_12px_30px_rgba(59,130,246,0.08)]"
                >
                  <p className="cp-label">{stat.label}</p>
                  <p className="mt-2 text-2xl font-black tracking-tight text-gray-900">{stat.value}</p>
                </article>
              ))}
            </aside>
          </div>

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
            className="cp-fade-up flex min-h-0 flex-1 flex-col gap-3 sm:gap-4"
          >
            <div className="flex w-full justify-center">
              <TabsList className="grid w-full max-w-none grid-cols-2 rounded-xl border border-sky-100 bg-blue-50 p-1 shadow-lg shadow-sky-200/25 sm:max-w-xl sm:rounded-2xl sm:p-1.5">
                <TabsTrigger
                  value="vault"
                  className="rounded-lg px-2 py-2 text-[11px] font-black uppercase tracking-wide text-sky-700 transition-all data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:shadow-md disabled:opacity-40 sm:px-3 sm:py-2.5 sm:text-sm sm:tracking-widest"
                  disabled={!isAuthenticated}
                >
                  🔐 Private Vault {!isAuthenticated && <span className="ml-1">🔒</span>}
                </TabsTrigger>
                <TabsTrigger
                  value="pulse"
                  disabled={!isOnline}
                  className="rounded-lg px-2 py-2 text-[11px] font-black uppercase tracking-wide text-gray-700 transition-all data-[state=active]:bg-green-200 data-[state=active]:text-green-900 data-[state=active]:shadow-sm disabled:opacity-40 sm:px-3 sm:py-2.5 sm:text-sm sm:tracking-widest"
                >
                  ✨ Public Pulse
                </TabsTrigger>
              </TabsList>
            </div>

            <section className="flex min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-[0_18px_60px_rgba(59,130,246,0.08)]">
              <ScrollArea className="h-full w-full">
                <div className="flex flex-col">
                  <TabsContent value="vault" className="cp-fade-up m-0 h-full p-3 sm:p-6 lg:p-8">
                    {!isAuthenticated ? (
                      <div className="mx-auto max-w-2xl rounded-[1.75rem] border border-green-200 bg-white px-6 py-12 text-center shadow-[0_16px_40px_rgba(59,130,246,0.08)]">
                        <p className="mb-4 text-4xl">🔒</p>
                        <h3 className="mb-2 text-2xl font-black text-gray-900">Private Vault Locked</h3>
                        <p className="mb-6 text-gray-600">
                          Sign in to access your encrypted document vault and store PDFs offline.
                        </p>
                        <button
                          onClick={() => promptLogin('access your Private Vault')}
                          className="inline-flex items-center justify-center rounded-full border border-blue-100 bg-blue-50 px-6 py-3 font-semibold text-sky-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-md"
                        >
                          Sign In to Access Vault
                        </button>
                      </div>
                    ) : (
                      <PrivateVaultView />
                    )}
                  </TabsContent>

                  <TabsContent value="pulse" className="cp-fade-up m-0 h-full p-3 sm:p-6 lg:p-8">
                    <PublicPulseView isReadOnly={!isAuthenticated} />
                  </TabsContent>
                </div>
              </ScrollArea>
            </section>
          </Tabs>

          <footer className="mt-auto border-t border-blue-100 bg-gradient-to-r from-blue-50 to-emerald-50/35 px-3 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center justify-between gap-3 text-left">
              <div>
                <p className="cp-pill text-green-700 sm:text-[10px]">
                  CamPulse Academic OS
                </p>
                <p className="mt-0.5 cp-body text-[11px] sm:text-xs">
                  © 2026 CamPulse
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 shadow-sm">
                <span
                  className={`h-2 w-2 rounded-full shadow-[0_0_0_4px_rgba(59,130,246,0.12)] ${
                    isAuthenticated ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
                <span className="cp-pill text-green-700 sm:text-[10px]">
                  {isAuthenticated ? 'Authenticated' : 'Guest'}
                </span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
