'use client';

import { useAuth } from '@/context/auth-context';
import { useRealtimePulse } from '@/hooks/useRealtimePulse';

const defaultDepartmentCode = process.env.NEXT_PUBLIC_DEFAULT_DEPARTMENT_CODE ?? 'COLPHY';

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

  return (
    <section className="space-y-6 text-gray-800 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px] shadow-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-bold text-[11px] uppercase tracking-wider text-gray-900">
              Activity
            </span>
          </div>
          <h2 className="text-[clamp(1.5rem,3vw,2.2rem)] leading-[1.2] tracking-[-0.03em] font-black bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent mb-3">Department Pulse</h2>
          <p className="cp-body max-w-2xl sm:text-base">
            Live activity feed — uploads, processing updates, and department events.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="inline-flex rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px] shadow-sm">
            <span className="inline-flex rounded-full bg-white px-3 py-1 font-bold text-[11px] uppercase tracking-wider text-gray-900">
              {realtime.connected ? `${realtime.presenceCount} online` : 'Offline'}
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

      <article className="rounded-[1.75rem] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-[0_12px_30px_rgba(59,130,246,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="cp-card-title text-gray-900">Live Feed</h3>
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full shadow-sm shadow-green-300/30 ${realtime.connected ? 'animate-pulse bg-green-500' : 'bg-slate-400'}`} />
            <span className="cp-pill rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sky-700">
              {realtime.connected ? `${realtime.presenceCount} live` : 'Connecting...'}
            </span>
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          {realtime.items.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-blue-200 bg-white px-6 py-8 text-center">
              <p className="text-sm text-gray-600">No recent activity in your department</p>
              <p className="mt-1 text-xs text-gray-500">Events will appear here when materials are uploaded or processed</p>
            </div>
          ) : (
            realtime.items.slice(0, 10).map((item, idx) => (
              <div
                key={`${item.title}-${idx}`}
                className="rounded-[1.25rem] border border-green-100 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-green-200"
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
            ))
          )}
        </div>
        {realtime.lastEvent && (
          <p className="mt-4 rounded-2xl border border-blue-100 bg-white px-4 py-3 text-xs text-slate-700 shadow-sm">
            Live update: {realtime.lastEvent.title}
            {realtime.lastEvent.message ? ` · ${realtime.lastEvent.message}` : ''}
          </p>
        )}
      </article>
    </section>
  );
}
