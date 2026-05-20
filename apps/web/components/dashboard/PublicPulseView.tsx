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
    <section className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-blue-950 sm:text-4xl">Public Pulse</h2>
          <p className="max-w-2xl text-sm text-slate-800 sm:text-base">
            Your department-aware live collaboration layer for topics, materials, and revision sessions happening now.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="inline-flex w-fit rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-800 shadow-sm">
            Live collaboration
          </span>
          {showReadOnlyUI && (
            <span className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 shadow-sm">
              👁️ Read-only
            </span>
          )}
        </div>
      </div>

      {showReadOnlyUI && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-blue-950">Create posts to contribute</p>
            <p className="text-sm text-slate-800 mt-1">
              Sign in to share your thoughts, ask questions, and collaborate with other students.
            </p>
          </div>
          <ProtectedActionButton
            icon="✍️"
            label="Sign In"
            action="post to Public Pulse"
            variant="primary"
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <article className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-blue-950">Live Pulse Feed</h3>
            <span className="h-3 w-3 animate-pulse rounded-full bg-green-500 shadow-sm shadow-green-300/30" />
          </div>
          <div className="mt-5 grid gap-3">
            {liveFeed.map((item) => (
              <div
                key={item.title}
                className={`rounded-xl border border-blue-200 bg-blue-50 p-4 transition-all duration-300 hover:border-blue-300 ${
                  showReadOnlyUI ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-blue-950">{item.title}</p>
                  <span className="rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-800">{item.activity}</p>
              </div>
            ))}
          </div>
          {!isAuthenticated && (
            <button
              onClick={() => {}}
              disabled
              className="mt-4 w-full px-4 py-2 bg-blue-100 text-blue-600 rounded-lg font-semibold cursor-not-allowed opacity-60 border border-blue-200"
            >
              Sign in to view more posts
            </button>
          )}
        </article>

        <article className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-blue-950">Upcoming Study Sessions</h3>
          <div className="mt-5 space-y-3">
            {sessions.map((session) => (
              <div
                key={session.topic}
                className={`rounded-xl border border-blue-200 bg-blue-50 p-4 transition-all duration-300 hover:border-blue-300 ${
                  showReadOnlyUI ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                }`}
              >
                <p className="text-xs font-black uppercase tracking-widest text-blue-800">
                  {session.when}
                </p>
                <p className="mt-2 font-bold text-blue-950">{session.topic}</p>
                <p className="text-xs text-slate-800">{session.where}</p>
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
