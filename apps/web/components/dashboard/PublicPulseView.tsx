'use client';

import { useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { ProtectedActionButton } from '@/components/auth/ProtectedActionButton';
import { useRealtimePulse } from '@/hooks/useRealtimePulse';

const defaultDepartmentCode = process.env.NEXT_PUBLIC_DEFAULT_DEPARTMENT_CODE ?? 'COLPHY';

const sessions = [
  { when: 'Tue • 4:00 PM', where: 'COLCOM LT-2', topic: 'Algorithm Design Clinic' },
  { when: 'Wed • 6:30 PM', where: 'Virtual', topic: 'GST Crash Revision' }
];

interface PublicPulseViewProps {
  isReadOnly?: boolean;
}

export function PublicPulseView({ isReadOnly = false }: PublicPulseViewProps) {
  const { isAuthenticated } = useAuth();
  const showReadOnlyUI = isReadOnly && !isAuthenticated;
  const realtime = useRealtimePulse({
    roomType: 'department',
    roomKey: defaultDepartmentCode,
    enabled: isAuthenticated
  });

  const liveFeed = useMemo(() => {
    if (realtime.items.length > 0) {
      return realtime.items.slice(0, 3);
    }

    return [
      { title: 'CSC 311: Mid-Sem Revision', activity: '12 new uploads', status: 'Hot' },
      { title: 'MTS 101: General Course Room', activity: '8 active students', status: 'Cross-college' },
      { title: 'PHY 204: Tutorial Thread', activity: '3 new comments', status: 'Trending' }
    ];
  }, [realtime.items]);

  return (
    <section className="space-y-6 text-gray-800 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px] shadow-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-bold text-[11px] uppercase tracking-wider text-gray-900">
              Community layer
            </span>
          </div>
          <h2 className="text-[clamp(1.5rem,3vw,2.2rem)] leading-[1.2] tracking-[-0.03em] font-black bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent mb-3">Public Pulse</h2>
          <p className="cp-body max-w-2xl sm:text-base">
            Your department-aware live collaboration layer for topics, materials, and revision sessions happening now.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="inline-flex rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px] shadow-sm">
            <span className="inline-flex rounded-full bg-white px-3 py-1 font-bold text-[11px] uppercase tracking-wider text-gray-900">
              Live collaboration
            </span>
          </span>
          {showReadOnlyUI && (
            <span className="inline-flex rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px] shadow-sm">
              <span className="inline-flex rounded-full bg-white px-3 py-1 font-bold text-[11px] uppercase tracking-wider text-gray-900">
                👁️ Read-only
              </span>
            </span>
          )}
        </div>
      </div>

      {showReadOnlyUI && (
        <div className="flex flex-col gap-3 rounded-[1.5rem] border border-blue-100 bg-gradient-to-br from-blue-50 to-emerald-100/60 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="cp-card-title text-gray-900">Create posts to contribute</p>
            <p className="cp-body mt-1 text-sm text-gray-800">
              Sign in to share your thoughts, ask questions, and collaborate with other students.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ProtectedActionButton
              icon="✍️"
              label="Sign In"
              action="post to Public Pulse"
              variant="primary"
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <article className="rounded-[1.75rem] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-[0_12px_30px_rgba(59,130,246,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="cp-card-title text-gray-900">Live Pulse Feed</h3>
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full shadow-sm shadow-green-300/30 ${realtime.connected ? 'animate-pulse bg-green-500' : 'bg-slate-400'}`} />
              <span className="cp-pill rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sky-700">
                {realtime.connected ? `${realtime.presenceCount} live` : 'Connecting...'}
              </span>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {liveFeed.map((item) => (
              <div
                key={item.title}
                className={`rounded-[1.25rem] border border-green-100 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-green-200 ${
                  showReadOnlyUI ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="cp-card-title text-gray-900">{item.title}</p>
                  <span className="inline-flex rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px]">
                    <span className="inline-flex rounded-full bg-white px-3 py-1 font-bold text-[11px] uppercase tracking-wider text-gray-900">
                      {item.status}
                    </span>
                  </span>
                </div>
                <p className="cp-body mt-2 text-sm">{item.activity}</p>
              </div>
            ))}
          </div>
          {realtime.lastEvent && (
            <p className="mt-4 rounded-2xl border border-blue-100 bg-white px-4 py-3 text-xs text-slate-700 shadow-sm">
              Live update: {realtime.lastEvent.title}
              {realtime.lastEvent.message ? ` · ${realtime.lastEvent.message}` : ''}
            </p>
          )}
          {!isAuthenticated && (
            <button
              onClick={() => {}}
              disabled
                className="mt-4 w-full rounded-full border border-transparent bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 px-4 py-3 font-black uppercase tracking-[0.16em] text-white cursor-not-allowed opacity-40"
            >
              Sign in to view more posts
            </button>
          )}
        </article>

        <article className="rounded-[1.75rem] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-[0_12px_30px_rgba(59,130,246,0.08)]">
          <h3 className="cp-card-title text-gray-900">Upcoming Study Sessions</h3>
          <div className="mt-5 space-y-3">
            {sessions.map((session) => (
              <div
                key={session.topic}
                className={`rounded-[1.25rem] border border-green-100 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-green-200 ${
                  showReadOnlyUI ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                }`}
              >
                <p className="font-bold text-[11px] uppercase tracking-wider text-transparent bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text">
                  {session.when}
                </p>
                <p className="cp-card-title mt-2 text-gray-900">{session.topic}</p>
                <p className="text-xs text-slate-700">{session.where}</p>
              </div>
            ))}
          </div>
          {!isAuthenticated && (
            <ProtectedActionButton
              icon="📅"
              label="Join Session"
              action="host or join study sessions"
              className="w-full mt-4"
              variant="primary"
            />
          )}
        </article>
      </div>
    </section>
  );
}
