'use client';

import { useAuth } from '@/context/auth-context';
import { ProtectedActionButton } from '@/components/auth/ProtectedActionButton';

const liveFeed = [
  { title: 'CSC 311: Mid-Sem Revision', activity: '12 new uploads', status: 'Hot' },
  { title: 'MTS 101: General Course Room', activity: '8 active students', status: 'Cross-college' },
  { title: 'PHY 204: Tutorial Thread', activity: '3 new comments', status: 'Trending' }
];

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

  return (
    <section className="space-y-6 text-gray-800 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="cp-pill inline-flex w-fit items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-green-700 shadow-sm">
            Community layer
          </div>
          <h2 className="cp-section-title font-black text-gray-900">Public Pulse</h2>
          <p className="cp-body max-w-2xl sm:text-base">
            Your department-aware live collaboration layer for topics, materials, and revision sessions happening now.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="cp-pill inline-flex w-fit rounded-full border border-green-300 bg-green-100 px-3 py-1 text-green-700 shadow-sm">
            Live collaboration
          </span>
          {showReadOnlyUI && (
            <span className="cp-pill inline-flex w-fit rounded-full border border-green-300 bg-green-100 px-3 py-1 text-green-700 shadow-sm">
              👁️ Read-only
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
            <span className="h-3 w-3 animate-pulse rounded-full bg-green-500 shadow-sm shadow-green-300/30" />
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
                  <span className="cp-pill rounded-full border border-green-300 bg-green-100 px-3 py-1 text-green-700">
                    {item.status}
                  </span>
                </div>
                <p className="cp-body mt-2 text-sm">{item.activity}</p>
              </div>
            ))}
          </div>
          {!isAuthenticated && (
            <button
              onClick={() => {}}
              disabled
              className="mt-4 w-full rounded-full border border-green-200 bg-green-50 px-4 py-3 font-black uppercase tracking-[0.16em] text-green-700 cursor-not-allowed opacity-70"
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
                <p className="cp-pill text-green-700">
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
