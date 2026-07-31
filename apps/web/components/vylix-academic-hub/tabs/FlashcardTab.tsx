'use client';

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/auth-context'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { DailyLimitModal } from '@/components/profile/DailyLimitModal'
import type { DocumentInfo } from '../ThreePanelLayout'

interface FlashcardTabProps {
  selectedDoc: DocumentInfo | null
  isReadOnly?: boolean
}

interface Deck {
  id: string
  title: string
  description: string | null
  document_id: string | null
  course_code: string | null
  card_count: number
  created_at: string
  updated_at: string
}

interface Card {
  id: string
  front: string
  back: string
  ease_factor: number
  interval_days: number
  next_review: string | null
  review_count: number
}

type View = 'decks' | 'review' | 'generate'

export function FlashcardTab({ selectedDoc, isReadOnly = false }: FlashcardTabProps) {
  const { promptLogin } = useAuth()
  const [view, setView] = useState<View>('decks')
  const [decks, setDecks] = useState<Deck[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [reviewDone, setReviewDone] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null)
  const [showLimitModal, setShowLimitModal] = useState(false)

  const supabase = getSupabaseBrowserClient()

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }, [supabase])

  const fetchDecks = useCallback(async () => {
    const headers = await authHeaders()
    const res = await fetch('/api/flashcards/decks', { headers })
    if (res.ok) setDecks(await res.json())
  }, [authHeaders])

  useEffect(() => { if (view === 'decks') fetchDecks() }, [view, fetchDecks])

  const openDeck = async (deck: Deck) => {
    const headers = await authHeaders()
    const res = await fetch(`/api/flashcards/decks/${deck.id}/cards`, { headers })
    if (res.ok) {
      const data: Card[] = await res.json()
      setCards(data)
      setSelectedDeck(deck)
      setCurrentIdx(0)
      setFlipped(false)
      setReviewDone(false)
      setReviewed(0)
      setView('review')
    }
  }

  const reviewCard = async (quality: number) => {
    if (!cards[currentIdx]) return
    const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' }
    await fetch('/api/flashcards/review', {
      method: 'POST',
      headers,
      body: JSON.stringify({ card_id: cards[currentIdx].id, quality }),
    })
    setReviewed((r) => r + 1)
    if (currentIdx < cards.length - 1) {
      setCurrentIdx((i) => i + 1)
      setFlipped(false)
    } else {
      setReviewDone(true)
    }
  }

  const generateFromDoc = async () => {
    if (!selectedDoc) return
    setGenerating(true)
    try {
      const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' }
      const res = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          document_id: selectedDoc.id,
          title: `${selectedDoc.name} — Flashcards`,
          count: 8,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setDecks((prev) => [data.deck, ...prev])
        setView('decks')
      } else if (res.status === 429) {
        const err = await res.json().catch(() => ({}))
        if (err.detail === 'DAILY_LIMIT_REACHED') {
          setShowLimitModal(true)
        }
      }
    } finally {
      setGenerating(false)
    }
  }

  const deleteDeck = async (deckId: string) => {
    const headers = await authHeaders()
    await fetch(`/api/flashcards/decks/${deckId}`, { method: 'DELETE', headers })
    setDecks((prev) => prev.filter((d) => d.id !== deckId))
  }

  // ── Empty state ────────────────────────────────────────────────
  if (isReadOnly) {
    return (
      <div className="flex flex-col h-full bg-white items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center mb-4">
          <span className="text-2xl">🧠</span>
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-1">Flashcards</h3>
        <p className="text-xs text-gray-400 mb-4 max-w-[220px]">Sign in to create flashcards and track your progress with spaced repetition.</p>
        <button
          onClick={() => promptLogin('use flashcards')}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold shadow-md"
        >
          Sign In
        </button>
      </div>
    )
  }

  // ── Generate view ──────────────────────────────────────────────
  if (view === 'generate') {
    return (
      <div className="flex flex-col h-full bg-white p-4">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setView('decks')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h3 className="text-sm font-bold text-gray-900">Generate Flashcards</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          {generating ? (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-100 flex items-center justify-center mx-auto animate-pulse">
                <span className="text-xl">✨</span>
              </div>
              <p className="text-sm font-medium text-gray-600">Generating flashcards...</p>
              <p className="text-xs text-gray-400">Analyzing document content</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-100 flex items-center justify-center mx-auto">
                <span className="text-2xl">🤖</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">AI Flashcard Generator</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[240px]">
                  {selectedDoc
                    ? `Generate 8 flashcards from "${selectedDoc.name}"`
                    : 'Select a document first to generate flashcards'}
                </p>
              </div>
              <button
                onClick={generateFromDoc}
                disabled={!selectedDoc}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 text-white text-xs font-bold shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generate 8 Cards
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Review view ────────────────────────────────────────────────
  if (view === 'review') {
    const card = cards[currentIdx]

    return (
      <div className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setView('decks')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-xs font-semibold text-gray-600">{selectedDeck?.title}</span>
          </div>
          <span className="text-[10px] font-bold text-gray-400">{currentIdx + 1}/{cards.length}</span>
        </div>

        {/* Progress bar */}
        <div className="px-4 pt-3 shrink-0">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full transition-all duration-300" style={{ width: `${((currentIdx + 1) / cards.length) * 100}%` }} />
          </div>
        </div>

        {/* Card */}
        {reviewDone ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Session Complete!</h3>
            <p className="text-sm text-gray-500 mb-1">You reviewed {reviewed} cards</p>
            <p className="text-xs text-gray-400 mb-6">Keep going — consistency builds mastery.</p>
            <button
              onClick={() => setView('decks')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold shadow-md"
            >
              Back to Decks
            </button>
          </div>
        ) : card ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            {/* Flip card */}
            <button
              onClick={() => setFlipped((f) => !f)}
              className="w-full max-w-[300px] aspect-[3/2] rounded-2xl shadow-lg border border-gray-100 p-6 flex items-center justify-center text-center transition-all duration-300 cursor-pointer select-none"
              style={{ perspective: '1000px' }}
            >
              <div className={`transition-all duration-300 ${flipped ? '[transform:rotateY(180deg)]' : ''}`} style={{ transformStyle: 'preserve-3d' }}>
                <div style={{ backfaceVisibility: 'hidden' }} className={flipped ? 'invisible absolute inset-0' : ''}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-2">Question</p>
                  <p className="text-sm font-medium text-gray-900 leading-relaxed">{card.front}</p>
                </div>
                <div style={{ backfaceVisibility: 'hidden' }} className={!flipped ? 'invisible absolute inset-0' : ''}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-2">Answer</p>
                  <p className="text-sm font-medium text-gray-900 leading-relaxed">{card.back}</p>
                </div>
              </div>
            </button>

            <p className="text-[10px] text-gray-400 mt-3 mb-4">Tap to flip</p>

            {/* Rating buttons */}
            {flipped && (
              <div className="flex gap-2 w-full max-w-[300px]">
                <button
                  onClick={() => reviewCard(0)}
                  className="flex-1 py-2.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold border border-red-100 hover:bg-red-100 transition-colors"
                >
                  Again
                </button>
                <button
                  onClick={() => reviewCard(1)}
                  className="flex-1 py-2.5 rounded-xl bg-amber-50 text-amber-600 text-xs font-bold border border-amber-100 hover:bg-amber-100 transition-colors"
                >
                  Hard
                </button>
                <button
                  onClick={() => reviewCard(2)}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
                >
                  Good
                </button>
                <button
                  onClick={() => reviewCard(3)}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors"
                >
                  Easy
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    )
  }

  // ── Deck list view ─────────────────────────────────────────────
  return (
    <>
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Flashcards</h3>
          <button
            onClick={() => setView('generate')}
            disabled={!selectedDoc}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-violet-500 text-white text-[10px] font-bold shadow-sm disabled:opacity-40"
          >
            + Generate
          </button>
        </div>
        {!selectedDoc && (
          <p className="text-[10px] text-gray-400 mt-1">Open a document to generate flashcards from it</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {decks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-100 flex items-center justify-center mb-3">
              <span className="text-xl">🧠</span>
            </div>
            <p className="text-xs font-semibold text-gray-600 mb-1">No flashcard decks yet</p>
            <p className="text-[10px] text-gray-400 max-w-[200px]">Open a document and click Generate to create your first deck.</p>
          </div>
        ) : (
          decks.map((deck) => (
            <div
              key={deck.id}
              className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <button onClick={() => openDeck(deck)} className="flex-1 text-left">
                  <p className="text-xs font-bold text-gray-900 truncate">{deck.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                      {deck.card_count} cards
                    </span>
                    {deck.course_code && (
                      <span className="text-[10px] font-semibold text-gray-400">{deck.course_code}</span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => deleteDeck(deck.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>

      <DailyLimitModal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)} />
    </>
  )
}
