'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import {
  buildReferralLink,
  fetchReferralCode,
  fetchReferrals,
  type ReferralCodeInfo,
  type ReferralInfo,
} from '@/lib/referral';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteModal({ isOpen, onClose }: InviteModalProps) {
  const { user, promptLogin } = useAuth();
  const [code, setCode] = useState<ReferralCodeInfo | null>(null);
  const [referrals, setReferrals] = useState<ReferralInfo[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const [info, list] = await Promise.all([
        fetchReferralCode(session.access_token),
        fetchReferrals(session.access_token),
      ]);
      if (info) setCode(info);
      setReferrals(list);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      load();
    }
  }, [isOpen, load]);

  if (!isOpen) return null;

  const shareLink = code ? buildReferralLink(code.code) : '';
  const whatsappText = encodeURIComponent(
    `Join me on Vylix — past questions, AI tutoring and study tools for Nigerian university students. ${shareLink}`
  );

  const handleCopy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Non-critical
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-blue-100 animate-scale-in max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm shadow-emerald-500/20">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Invite Friends</h2>
              <p className="text-[11px] text-gray-400">Earn {code?.points_per_referral ?? 100} points per friend</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100/80 active:bg-gray-200/60 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!user ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700">Sign in to get your invite link</p>
              <p className="text-xs text-gray-400 mt-1">You earn 100 points and your friend earns 50 when they join.</p>
              <button
                onClick={() => { onClose(); promptLogin('invite friends'); }}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white text-sm font-bold shadow-lg shadow-blue-600/20 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
              >
                Sign In
              </button>
            </div>
          ) : loading && !code ? (
            <div className="flex items-center justify-center py-10">
              <svg className="w-6 h-6 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : code ? (
            <>
              {/* Invite link */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Your invite link</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5">
                    <p className="text-xs font-mono text-gray-800 truncate">{shareLink}</p>
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`inline-flex items-center gap-1.5 text-xs px-3.5 py-2.5 rounded-xl font-bold transition-all duration-200 shrink-0 ${
                      copied
                        ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <a
                  href={`https://wa.me/?text=${whatsappText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] text-white text-sm font-bold shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Share on WhatsApp
                </a>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50/60 border border-emerald-100/60 px-4 py-3">
                  <p className="text-xl font-bold text-emerald-600">{code.total_earned}</p>
                  <p className="text-[11px] font-medium text-emerald-700/70">points earned</p>
                </div>
                <div className="rounded-xl bg-blue-50/60 border border-blue-100/60 px-4 py-3">
                  <p className="text-xl font-bold text-blue-600">{referrals.length}</p>
                  <p className="text-[11px] font-medium text-blue-700/70">friends joined</p>
                </div>
              </div>

              {/* Friends who joined */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Friends who joined</p>
                {referrals.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                    No friends yet — share your link to start earning.
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                    {referrals.map((r, i) => (
                      <li key={i} className="flex items-center gap-3 px-3 py-2.5 bg-white">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                          {r.referee_avatar ? (
                            <img src={r.referee_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            (r.referee_name || 'S').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700 truncate">{r.referee_name || 'Friend'}</p>
                          <p className="text-[10px] text-gray-400">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                          </p>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-600">+{r.points_earned}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">Couldn&apos;t load your invite link. Try again.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
