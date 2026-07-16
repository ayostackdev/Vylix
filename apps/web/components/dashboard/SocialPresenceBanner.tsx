'use client';

import { useSocialPresence } from '@/queries/use-digest';
import { useAuth } from '@/context/auth-context';

export function SocialPresenceBanner() {
  const { isAuthenticated } = useAuth();
  const { data: presence } = useSocialPresence();

  if (!isAuthenticated || !presence || presence.active_now === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/80 border border-emerald-200/40">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
      <span className="text-[11px] text-emerald-600 font-medium">
        {presence.classmates_active.length > 0 ? (
          <>
            <span className="font-bold">{presence.classmates_active.length}</span>
            {presence.classmates_active.length === 1 ? ' classmate' : ' classmates'} in your department online
          </>
        ) : (
          <>
            <span className="font-bold">{presence.active_now}</span>
            {presence.active_now === 1 ? ' student' : ' students'} studying right now
          </>
        )}
      </span>
    </div>
  );
}
