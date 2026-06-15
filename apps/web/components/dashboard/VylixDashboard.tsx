'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PrivateVaultView } from '@/components/dashboard/PrivateVaultView';
import { PublicPulseView } from '@/components/dashboard/PublicPulseView';
import { PastQuestionsView } from '@/components/dashboard/PastQuestionsView';
import { useNetworkState } from '@/hooks/useNetworkState';
import { useAuth } from '@/context/auth-context';
import { ReadOnlyBanner } from '@/components/auth/ReadOnlyMode';
import { SchoolEmailBanner } from '@/components/auth/SchoolEmailBanner';
import { LevelUpdateBanner } from '@/components/dashboard/LevelUpdateBanner';

export function VylixDashboard() {
  const [activeLayer, setActiveLayer] = useState<'vault' | 'pulse' | 'questions'>('pulse');
  const { isOnline } = useNetworkState();
  const { user, isAuthenticated, promptLogin } = useAuth();
  const isAlumni = user?.status === 'ALUMNI';
  const userInitials = user?.fullName?.charAt(0) ?? 'CS';
  const spotlightStats = [
    { label: 'Vault readiness', value: isAlumni ? 'Archive' : isAuthenticated ? 'Unlocked' : 'Preview' },
    { label: 'Pulse mode', value: isOnline ? 'Live' : 'Offline' },
    { label: 'Identity', value: isAlumni ? 'Alumni' : isAuthenticated ? 'Synced' : 'Guest' },
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
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden overflow-y-auto px-4 py-3 text-gray-800 sm:px-6 sm:py-4 md:px-8 md:py-8 lg:px-12 lg:py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-200/35 blur-2xl cp-float" />
      <div className="pointer-events-none absolute right-[-5rem] top-24 h-[28rem] w-[28rem] rounded-full bg-green-200/28 blur-2xl cp-shimmer" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/50 to-transparent" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-1 min-h-0 flex-col gap-3 overflow-visible md:gap-6">
        <header className="sticky top-0 z-50 w-full border-b border-blue-100 bg-white/80 p-4 backdrop-blur">
          <div className="cp-fade-up flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px] shadow-sm">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-bold text-[11px] uppercase tracking-wider text-gray-900">
                  Academic Hub
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Core Edition
                </span>
              </div>

              <div className="space-y-2">
                <h1 className="text-[clamp(2.2rem,6vw,4.2rem)] leading-[1.1] tracking-[-0.04em] font-black bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent mb-4">
                  Vylix
                </h1>
                <p className="cp-body max-w-2xl sm:text-base">
                  A polished academic workspace that keeps your vault, pulse feed, and student identity in one calm, fast place.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-800 lg:justify-end">
                <span className="rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px] shadow-sm">
                  <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-900 sm:text-xs">
                    {isAuthenticated ? 'Private + Public Learning' : 'Browse Public Content'}
                  </span>
                </span>
                {!isOnline ? (
                  <Badge variant="destructive" className="px-3 py-1 text-[11px] sm:text-xs">
                    Offline Mode Active
                  </Badge>
                ) : isAlumni ? (
                  <span className="cp-pill inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[11px] font-semibold text-purple-700 ring-1 ring-purple-100/70 sm:text-xs">🎓 Alumni — Read Only</span>
                ) : isAuthenticated ? (
                  <Badge variant="success" className="px-3 py-1 text-[11px] sm:text-xs">Live & Connected</Badge>
                ) : (
                  <Badge variant="default" className="px-3 py-1 text-[11px] sm:text-xs">Browse Only</Badge>
                )}
              </div>

              <div className="flex items-center gap-4 rounded-[1.5rem] border border-blue-100 bg-blue-50 px-4 py-3 shadow-sm">
                <Avatar className="h-14 w-14 shadow-sm ring-4 ring-blue-100 sm:h-16 sm:w-16 [border:2px_solid_transparent] bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[2px] [&>div]:rounded-full">
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
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-[2rem] border border-blue-100 bg-blue-50/95 p-4 shadow-[0_24px_80px_rgba(148,163,184,0.14)] sm:gap-5 sm:p-5 md:p-6 lg:p-7">
          <aside className="cp-fade-up grid gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:gap-4">
            {spotlightStats.map((stat, index) => (
              <article
                key={stat.label}
                className="rounded-[1.5rem] border-l-4 border-t border-blue-100 bg-white p-4 shadow-[0_12px_30px_rgba(59,130,246,0.08)]"
                style={{ borderLeftColor: ['#2563eb', '#0ea5e9', '#10b981'][index] }}
              >
                <p className="cp-label">{stat.label}</p>
                <p className="mt-2 text-2xl font-black tracking-tight bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent">{stat.value}</p>
              </article>
            ))}
          </aside>

          {!isAuthenticated && (
            <ReadOnlyBanner action="upload materials and access full features" />
          )}

          {isAuthenticated && !isAlumni && !user?.schoolEmail && <SchoolEmailBanner />}

          {isAuthenticated && !isAlumni && <LevelUpdateBanner />}

          {isAlumni && (
            <div className="cp-fade-up rounded-[1.75rem] border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/60 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎓</span>
                <div>
                  <p className="font-bold text-purple-900">Alumni Account — Read Only</p>
                  <p className="mt-1 text-sm text-purple-800">
                    Welcome back! As an alumnus, you can browse materials, view your vault, and explore the Public Pulse. 
                    Uploading new content and posting are not available.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Tabs
            value={activeLayer}
            onValueChange={(val) => {
              if (val === 'vault' && !isAuthenticated) {
                promptLogin('access your Private Vault');
              } else {
                setActiveLayer(val as 'vault' | 'pulse' | 'questions');
              }
            }}
            className="cp-fade-up flex min-h-0 flex-1 flex-col gap-3 sm:gap-4"
          >
            <div className="flex w-full justify-center">
              <TabsList className="grid w-full max-w-none grid-cols-3 rounded-xl border border-sky-100 bg-blue-50 p-1 shadow-lg shadow-sky-200/25 sm:max-w-2xl sm:rounded-2xl sm:p-1.5">
                <TabsTrigger
                  value="vault"
                  className="rounded-lg px-1 py-2 text-[10px] font-black uppercase tracking-wide transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:via-sky-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md disabled:opacity-40 sm:px-3 sm:py-2.5 sm:text-sm sm:tracking-widest text-gray-600"
                  disabled={!isAuthenticated}
                >
                  <span className="sm:hidden">🔐</span>
                  <span className="hidden sm:inline">🔐 Vault</span>
                  {!isAuthenticated && <span className="ml-1 hidden sm:inline">🔒</span>}
                </TabsTrigger>
                <TabsTrigger
                  value="questions"
                  className="rounded-lg px-1 py-2 text-[10px] font-black uppercase tracking-wide transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:via-sky-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md disabled:opacity-40 sm:px-3 sm:py-2.5 sm:text-sm sm:tracking-widest text-gray-600"
                >
                  <span className="sm:hidden">📝</span>
                  <span className="hidden sm:inline">📝 Questions</span>
                </TabsTrigger>
                <TabsTrigger
                  value="pulse"
                  disabled={!isOnline}
                  className="rounded-lg px-1 py-2 text-[10px] font-black uppercase tracking-wide transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:via-sky-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md disabled:opacity-40 sm:px-3 sm:py-2.5 sm:text-sm sm:tracking-widest text-gray-600"
                >
                  <span className="sm:hidden">✨</span>
                  <span className="hidden sm:inline">✨ Pulse</span>
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
                        <h3 className="mb-2 text-2xl font-black bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent">Private Vault Locked</h3>
                        <p className="mb-6 text-gray-700">
                          Sign in to access your encrypted document vault and store PDFs offline.
                        </p>
                        <button
                          onClick={() => promptLogin('access your Private Vault')}
                          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-6 py-3 font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
                        >
                          Sign In to Access Vault
                        </button>
                      </div>
                    ) : (
                      <PrivateVaultView />
                    )}
                  </TabsContent>

                  <TabsContent value="questions" className="cp-fade-up m-0 h-full p-3 sm:p-6 lg:p-8">
                    <PastQuestionsView />
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
                <p className="font-bold text-[10px] uppercase tracking-wider bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent">
                  Vylix Academic
                </p>
                <p className="mt-0.5 cp-body text-[11px] sm:text-xs">
                  © 2026 Vylix
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
