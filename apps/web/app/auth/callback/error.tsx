'use client';

export default function AuthCallbackError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-emerald-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-8 shadow-lg text-center">
        <div className="mb-4 text-4xl">!</div>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Sign in failed</h2>
        <p className="mb-6 text-sm text-gray-500">
          {error.message || 'Could not complete authentication.'}
        </p>
        <button
          onClick={reset}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
