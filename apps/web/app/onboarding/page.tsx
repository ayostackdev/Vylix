'use client';

import { Suspense } from 'react'
import { OnboardingScreen } from '@/components/vylix-academic-hub/OnboardingScreen'
import { useRouter } from 'next/navigation'

function OnboardingContent() {
  const router = useRouter()
  return <OnboardingScreen onComplete={() => router.push('/')} />
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#0B0E1A] via-[#171234] to-[#2E0A3D]">
        <div className="text-white/50 text-sm font-medium">Loading...</div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  )
}
