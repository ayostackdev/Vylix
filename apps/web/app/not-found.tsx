import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-indigo-50 via-violet-50 to-fuchsia-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-lg text-center">
        <div className="mb-4 text-5xl font-bold text-gray-200">404</div>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Page not found</h2>
        <p className="mb-6 text-sm text-gray-500">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 active:bg-indigo-800"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
