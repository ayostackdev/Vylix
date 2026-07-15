export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-emerald-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm font-medium text-gray-400">Loading...</p>
      </div>
    </div>
  );
}
