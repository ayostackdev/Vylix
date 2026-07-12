'use client';

import { Suspense, useState, useEffect } from 'react'
import { OnboardingScreen } from '@/components/vylix-academic-hub/OnboardingScreen'
import { ThreePanelLayout } from '@/components/vylix-academic-hub/ThreePanelLayout'

function OnboardingWrapper({ onComplete }: { onComplete: () => void }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-blue-950 via-indigo-950 to-emerald-950">
        <div className="text-white/50 text-sm font-medium">Loading...</div>
      </div>
    }>
      <OnboardingScreen onComplete={onComplete} />
    </Suspense>
  )
}

export default function HomePage() {
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const onboarded = localStorage.getItem('vylix_onboarded')
    if (onboarded) {
      setShowOnboarding(false)
    }
  }, [])

  const handleOnboardingComplete = () => {
    localStorage.setItem('vylix_onboarded', 'true')
    setShowOnboarding(false)
  }

  if (!mounted) {
    return null
  }

  if (showOnboarding) {
    return <OnboardingWrapper onComplete={handleOnboardingComplete} />
  }

  return <ThreePanelLayout />
}
