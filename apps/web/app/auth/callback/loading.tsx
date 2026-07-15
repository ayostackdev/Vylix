export default function AuthCallbackLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-emerald-50">
      <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-lg text-center">
        <div className="mb-4 text-4xl">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
        <p className="text-gray-700 font-medium">Completing sign in...</p>
      </div>
    </div>
  );
}
