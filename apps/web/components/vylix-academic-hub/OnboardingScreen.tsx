'use client';

import { useState, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useSearchParams } from 'next/navigation'

type Step = 'welcome' | 'auth' | 'drive' | 'importing' | 'complete'

interface AutoImportResult {
  folders_scanned: number
  pdfs_found: number
  imported: number
  skipped: number
  topics_created: string[]
  errors: string[]
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

interface OnboardingScreenProps {
  onComplete: () => void
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>('welcome')
  const [isLoading, setIsLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [importResult, setImportResult] = useState<AutoImportResult | null>(null)

  useEffect(() => {
    const driveStatus = searchParams.get('drive')
    if (driveStatus === 'connected') {
      setStep('importing')
      runAutoImport()
    } else if (driveStatus === 'error') {
      const detail = searchParams.get('detail') || 'unknown'
      setAuthError(`Drive connection failed: ${detail.replace(/_/g, ' ')}`)
      setStep('drive')
    }
  }, [searchParams])

  const runAutoImport = async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setStep('complete')
        return
      }
      const res = await fetch(`${API_BASE}/api/google-drive/auto-import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setImportResult(data)
      }
    } catch {
      // Non-critical, continue to dashboard
    }
    setStep('complete')
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setAuthError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      // User will be redirected to Google, then back to /auth/callback
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed')
      setIsLoading(false)
    }
  }

  const handleConnectDrive = async () => {
    setIsLoading(true)
    setAuthError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setAuthError('Please sign in first')
        setIsLoading(false)
        return
      }
      const res = await fetch(`${API_BASE}/api/google-drive/connect`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to start Drive connection')
      const { auth_url } = await res.json()
      window.location.href = auth_url
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to connect Drive')
      setIsLoading(false)
    }
  }

  const handleComplete = () => {
    onComplete()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto relative">
      {/* Premium animated mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-indigo-950 to-emerald-950">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(16, 185, 129, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 40% 80%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
          backgroundSize: '200% 200%',
          animation: 'gradientShift 12s ease infinite',
        }} />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
      </div>

      <div className="w-full max-w-md mx-auto premium-fade-in relative z-10">
        {/* Premium Logo */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 mb-4 shadow-2xl shadow-blue-500/10 premium-fade-in">
            <span className="text-3xl sm:text-4xl font-black text-gradient" style={{ WebkitTextFillColor: 'transparent', background: 'linear-gradient(135deg, #60a5fa, #34d399)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>V</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight premium-slide-up">Vylix</h1>
          <p className="text-xs sm:text-sm text-white/40 mt-1.5 font-medium premium-slide-up" style={{ animationDelay: '100ms' }}>Clear the clutter, master your course.</p>
        </div>

        {/* Premium Steps indicator */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-10 premium-slide-up" style={{ animationDelay: '200ms' }}>
          {(['welcome', 'auth', 'drive'] as const).map((s, i) => {
            const currentIndex = ['welcome', 'auth', 'drive'].indexOf(step)
            const isComplete = currentIndex > i
            const isCurrent = step === s
            return (
              <div key={s} className="flex items-center gap-3 sm:gap-4">
                <div className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-500 ${
                  isCurrent
                    ? 'bg-white text-gray-900 shadow-lg shadow-white/20 ring-4 ring-white/10'
                    : isComplete
                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-white/5 text-white/30 border border-white/10'
                }`}>
                  {isComplete ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 2 && (
                  <div className={`w-8 sm:w-10 h-0.5 rounded-full transition-all duration-500 ${
                    isComplete ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-white/10'
                  }`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Premium Card */}
        <div className="bg-white/[0.07] backdrop-blur-2xl rounded-3xl p-6 sm:p-8 border border-white/[0.08] shadow-2xl shadow-black/20 premium-slide-up" style={{ animationDelay: '300ms' }}>
          {step === 'welcome' && (
            <div className="premium-fade-in text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center mx-auto mb-5">
                <span className="text-3xl">📚</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2.5 tracking-tight">Welcome to Vylix</h2>
              <p className="text-xs sm:text-sm text-white/50 mb-8 leading-relaxed max-w-xs mx-auto">
                Your AI-powered study companion. Upload materials, get smart summaries, practice with past questions, and track your progress.
              </p>
              <button
                onClick={() => setStep('auth')}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-bold text-sm btn-glow shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                Get Started
              </button>
              <button onClick={handleComplete} className="block mx-auto mt-4 text-xs text-white/25 hover:text-white/50 transition-colors font-medium">
                Skip for now
              </button>
            </div>
          )}

          {step === 'auth' && (
            <div className="premium-fade-in">
              <div className="text-center mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">Welcome Aboard!</h2>
                <p className="text-xs sm:text-sm text-white/50">Sign in to start your learning journey.</p>
              </div>
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white text-gray-900 font-bold text-sm hover:bg-white/95 transition-all shadow-xl shadow-black/10 disabled:opacity-70 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                {isLoading ? 'Signing in...' : 'Continue with Google'}
              </button>
              {authError && (
                <p className="text-center text-xs text-red-400 mt-3 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">{authError}</p>
              )}
              <p className="text-center text-[10px] sm:text-xs text-white/30 mt-5 leading-relaxed">
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </p>
              <button onClick={handleComplete} className="block mx-auto mt-4 text-xs text-white/25 hover:text-white/50 transition-colors font-medium">
                Skip for now
              </button>
            </div>
          )}

          {step === 'drive' && (
            <div className="premium-fade-in">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/10">
                  <span className="text-3xl">☁️</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">Connect Your Drive</h2>
                <p className="text-xs sm:text-sm text-white/50">Link your Google Drive to import course PDFs automatically.</p>
              </div>
              <button
                onClick={handleConnectDrive}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-bold text-sm btn-glow shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-70"
              >
                {isLoading ? (
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                {isLoading ? 'Connecting...' : 'Connect Google Drive'}
              </button>
              <button onClick={() => setStep('complete')} className="block mx-auto mt-4 text-xs text-white/25 hover:text-white/50 transition-colors font-medium">
                Skip this step
              </button>
            </div>
          )}

          {step === 'importing' && (
            <div className="premium-fade-in text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/10">
                <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">Scanning Your Drive</h2>
              <p className="text-xs sm:text-sm text-white/50 leading-relaxed">
                Finding your course PDFs and organizing them into folders...
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center premium-fade-in">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/30">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">You&apos;re All Set!</h2>
              {importResult ? (
                <div className="mb-6">
                  <p className="text-xs sm:text-sm text-white/50 mb-3">
                    Found <span className="text-white font-bold">{importResult.pdfs_found}</span> PDF{importResult.pdfs_found !== 1 ? 's' : ''} across{' '}
                    <span className="text-white font-bold">{importResult.folders_scanned}</span> folder{importResult.folders_scanned !== 1 ? 's' : ''}
                  </p>
                  <div className="inline-flex items-center gap-4 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {importResult.imported} imported
                    </span>
                    {importResult.skipped > 0 && (
                      <span>{importResult.skipped} already had</span>
                    )}
                    {importResult.topics_created.length > 0 && (
                      <span>{importResult.topics_created.length} course{importResult.topics_created.length !== 1 ? 's' : ''} found</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-white/50 mb-6">Your courses are ready. Let&apos;s start learning!</p>
              )}
              <button
                onClick={handleComplete}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-bold text-sm btn-glow shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-white/15 mt-6 font-medium tracking-wider">
          VYLIX.TECH
        </p>
      </div>
    </div>
  )
}
