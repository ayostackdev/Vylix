export default function OnboardingLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#0B0E1A] via-[#171234] to-[#2E0A3D]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white/80" />
        <p className="text-sm font-medium text-white/50">Loading...</p>
      </div>
    </div>
  );
}
