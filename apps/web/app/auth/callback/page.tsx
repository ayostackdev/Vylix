'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Completing sign in...');

  const restoreSessionFromHash = useCallback(async () => {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token=')) return null;

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn = params.get('expires_in');

    if (!accessToken || !refreshToken) return null;

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) throw error;
    window.location.hash = '';
    return data.session;
  }, []);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setMessage(`Sign in failed: ${errorParam.replace(/_/g, ' ')}`);
      setTimeout(() => router.push('/'), 3000);
    }
  }, [searchParams, router]);

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = getSupabaseBrowserClient();

      let session = (await supabase.auth.getSession()).data?.session;

      if (!session) {
        session = await restoreSessionFromHash();
      }

      if (session) {
        setMessage('Signed in successfully!');
        setTimeout(() => router.push('/'), 500);
      } else {
        const errorParam = searchParams.get('error');
        if (!errorParam) {
          setMessage('No session found. Redirecting...');
          setTimeout(() => router.push('/'), 2000);
        }
      }
    };

    handleCallback();
  }, [router, searchParams, restoreSessionFromHash]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-emerald-50">
      <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-lg text-center">
        <div className="mb-4 text-4xl">
          {message.includes('successfully') ? '✅' : message.includes('failed') || message.includes('error') ? '❌' : '🔄'}
        </div>
        <p className="text-gray-700 font-medium">{message}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-emerald-50">
        <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-lg text-center">
          <div className="mb-4 text-4xl">🔄</div>
          <p className="text-gray-700 font-medium">Completing sign in...</p>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
