'use client';

import { Suspense, useState, useEffect } from 'react'
import { OnboardingScreen } from '@/components/vylix-academic-hub/OnboardingScreen'
import { ThreePanelLayout } from '@/components/vylix-academic-hub/ThreePanelLayout'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

function OnboardingWrapper({ onComplete }: { onComplete: () => void }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#0B0E1A] via-[#171234] to-[#2E0A3D]">
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
      return
    }
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        localStorage.setItem('vylix_onboarded', 'true')
        setShowOnboarding(false)
      }
    })
  }, [])

  const handleOnboardingComplete = () => {
    localStorage.setItem('vylix_onboarded', 'true')
    setShowOnboarding(false)
  }

  if (!mounted) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#0B0E1A] via-[#171234] to-[#2E0A3D]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-blue-600/10">
            <span className="text-3xl font-black text-white" style={{ WebkitTextFillColor: 'transparent', background: 'linear-gradient(135deg, #818cf8, #e879f9)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>V</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Vylix Academic Hub</h1>
          <p className="text-sm text-white/40 mt-1">Clear the clutter, master your course.</p>
        </div>
      </div>
    )
  }

  if (showOnboarding) {
    return <OnboardingWrapper onComplete={handleOnboardingComplete} />
  }

  return <ThreePanelLayout />
}
