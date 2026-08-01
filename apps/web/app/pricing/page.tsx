'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, promptLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('trxref');
    if (!ref || !user) return;

    const verify = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/payments/verify?reference=${ref}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/'), 3000);
      }
    };

    verify();
  }, [searchParams, user, router]);

  const handleSubscribe = async () => {
    if (!user) {
      promptLogin('subscribe to Premium');
      return;
    }

    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const email = session.user.email || '';
    if (!email) {
      alert('No email found on your account. Please update your profile.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert(data.detail || 'Payment initialization failed. Please try again.');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎉</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Welcome to Premium!</h1>
          <p className="text-sm text-gray-500 mb-4">You now have 100 AI queries/day. Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-sm font-bold text-gray-900 hover:text-blue-600 transition-colors">
            Vylix
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Upgrade to Premium</h1>
          <p className="text-gray-500 max-w-md mx-auto">
            Get unlimited access to AI-powered study tools. One payment. Full year.
          </p>
        </div>

        <div className="max-w-sm mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-center text-white">
              <p className="text-sm font-medium opacity-80">Annual Premium</p>
              <p className="text-4xl font-bold mt-1">
                <span className="text-lg align-top">#</span>2,500
              </p>
              <p className="text-sm opacity-80 mt-1">per year</p>
            </div>

            <div className="p-6 space-y-4">
              <ul className="space-y-3">
                {[
                  '100 AI queries/day (up from 15)',
                  'AI Professor with document chat',
                  'AI flashcard generation',
                  'Study Agent personalized plans',
                  'Priority support',
                  'Ad-free experience',
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm hover:shadow-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50"
              >
                {loading ? 'Redirecting to Paystack...' : 'Subscribe Now — #2,500/yr'}
              </button>

              <p className="text-[10px] text-gray-400 text-center">
                Secured by Paystack. You can cancel anytime.
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center mt-6">
            Free tier includes 15 AI queries/day with access to all core features.
          </p>
        </div>
      </div>
    </div>
  );
}
