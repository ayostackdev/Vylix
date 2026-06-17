'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Completing sign in...');

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setMessage(`Authentication failed: ${error.message}`);
        setTimeout(() => router.push('/'), 3000);
        return;
      }

      if (data?.session) {
        setMessage('Signed in successfully!');
        setTimeout(() => router.push('/'), 500);
      } else {
        setMessage('No session found. Redirecting...');
        setTimeout(() => router.push('/'), 2000);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-emerald-50">
      <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-lg text-center">
        <div className="mb-4 text-4xl">
          {message.includes('successfully') ? '✅' : '🔄'}
        </div>
        <p className="text-gray-700 font-medium">{message}</p>
      </div>
    </div>
  );
}
