'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-8 shadow-lg text-center">
        <div className="mb-4 text-4xl">!</div>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Something went wrong</h2>
        <p className="mb-6 text-sm text-gray-500">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 active:bg-indigo-800"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
