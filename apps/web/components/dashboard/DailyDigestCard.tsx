'use client';

import { useDailyDigest, useSocialPresence } from '@/queries/use-digest';
import { useAuth } from '@/context/auth-context';

export function DailyDigestCard() {
  const { isAuthenticated } = useAuth();
  const { data: digest, isLoading } = useDailyDigest();
  const { data: presence } = useSocialPresence();

  if (!isAuthenticated) return null;
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
        <div className="h-5 bg-gray-100 rounded w-48 mb-3" />
        <div className="h-3 bg-gray-50 rounded w-32" />
      </div>
    );
  }
  if (!digest) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Greeting + Streak */}
      <div className="p-5 pb-3 digest-card-bg">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight">{digest.greeting}</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">
              {digest.new_notifications > 0
                ? `${digest.new_notifications} new notification${digest.new_notifications > 1 ? 's' : ''}`
                : 'All caught up'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {digest.streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60">
                <span className="text-sm">🔥</span>
                <span className="text-xs font-bold text-orange-600">{digest.streak}</span>
              </div>
            )}
            {digest.total_points > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#fbf5dd] to-[#f6ecc8] border border-[#e6d59b]">
                <span className="text-sm">⭐</span>
                <span className="text-xs font-bold text-[#96760f]">{digest.total_points}</span>
              </div>
            )}
          </div>
        </div>

        {/* Social presence */}
        {presence && presence.active_now > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {presence.classmates_active.slice(0, 3).map((c) => (
                <div
                  key={c.user_id}
                  className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-sky-500 border-2 border-white flex items-center justify-center text-[7px] font-bold text-white"
                  title={c.full_name}
                >
                  {c.full_name.charAt(0)}
                </div>
              ))}
            </div>
            <span className="text-[11px] text-gray-400 font-medium">
              {presence.classmates_active.length > 0
                ? `${presence.classmates_active.length} classmate${presence.classmates_active.length > 1 ? 's' : ''} studying now`
                : `${presence.active_now} student${presence.active_now > 1 ? 's' : ''} online`}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        )}
      </div>

      {/* Course Activity */}
      {digest.courses_with_activity.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-50">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Course Activity</h3>
          <div className="space-y-2">
            {digest.courses_with_activity.slice(0, 3).map((c) => (
              <div key={c.course_id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center text-white text-[8px] font-bold shrink-0">
                    {c.course_code.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{c.course_code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.new_materials > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600">
                      {c.new_materials} material{c.new_materials > 1 ? 's' : ''}
                    </span>
                  )}
                  {c.new_questions > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600">
                      {c.new_questions} question{c.new_questions > 1 ? 's' : ''}
                    </span>
                  )}
                  {c.active_classmates > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600">
                      {c.active_classmates} active
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Study Tip */}
      <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50">
        <div className="flex items-start gap-2">
          <span className="text-sm shrink-0 mt-0.5">💡</span>
          <p className="text-[11px] text-gray-500 leading-relaxed">{digest.study_tip}</p>
        </div>
      </div>
    </div>
  );
}
