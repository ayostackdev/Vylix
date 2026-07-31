'use client';

import { useState, useEffect, useCallback } from 'react'
import { quizDb, PAST_QUESTIONS, type QuizQuestion, type TopicPerformance } from '@/lib/quiz-store'
import { useAuth } from '@/context/auth-context'
import type { DocumentInfo } from '../ThreePanelLayout'

interface PracticeTabProps {
  selectedDoc: DocumentInfo | null
  isReadOnly?: boolean
}

type PracticeView = 'select' | 'quiz' | 'result' | 'performance'

export function PracticeTab({ selectedDoc, isReadOnly = false }: PracticeTabProps) {
  const { promptLogin } = useAuth()
  const [view, setView] = useState<PracticeView>('select')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [score, setScore] = useState(0)
  const [total, setTotal] = useState(0)
  const [weakTopics, setWeakTopics] = useState<TopicPerformance[]>([])
  const [answers, setAnswers] = useState<{ question: QuizQuestion; selected: number; correct: boolean }[]>([])

  useEffect(() => {
    quizDb.getWeakTopics().then(setWeakTopics)
  }, [])

  const startQuiz = useCallback(async (courseId: string) => {
    let qs = PAST_QUESTIONS[courseId]
    if (!qs) {
      const all = await quizDb.getQuestions(courseId)
      qs = all
    }
    if (!qs || qs.length === 0) return
    const shuffled = [...qs].sort(() => Math.random() - 0.5)
    setQuestions(shuffled)
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setShowAnswer(false)
    setScore(0)
    setTotal(shuffled.length)
    setAnswers([])
    setView('quiz')
  }, [])

  const handleAnswer = useCallback(async (index: number) => {
    if (showAnswer) return
    setSelectedAnswer(index)
    setShowAnswer(true)
    const q = questions[currentIndex]
    const correct = index === q.correctIndex
    if (correct) setScore(s => s + 1)
    setAnswers(prev => [...prev, { question: q, selected: index, correct }])

    await quizDb.recordAttempt({
      questionId: q.id,
      selectedIndex: index,
      correct,
      timestamp: Date.now(),
    })
  }, [showAnswer, questions, currentIndex])

  const nextQuestion = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1)
      setSelectedAnswer(null)
      setShowAnswer(false)
    } else {
      setView('result')
      quizDb.getWeakTopics().then(setWeakTopics)
    }
  }, [currentIndex, questions.length])

  const currentQuestion = questions[currentIndex]

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-3 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
        <div className="flex items-center gap-2">
          {view !== 'select' && (
            <button
              onClick={() => { if (view === 'quiz' && !confirm('Quit this quiz? Your progress will be lost.')) return; setView('select'); quizDb.getWeakTopics().then(setWeakTopics) }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
              aria-label="Back to courses"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Practice</h3>
            <p className="text-xs text-gray-400">
              {view === 'select' ? 'Choose a course to practice' : `${currentIndex + 1} of ${total}`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {view === 'select' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-2">Select a course to practice with past questions:</p>

            {selectedDoc && (
              <button
                onClick={() => isReadOnly ? promptLogin('take quizzes') : startQuiz(selectedDoc.courseId)}
                className="w-full text-left p-3 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors"
              >
                <p className="font-medium text-sm text-indigo-800">{selectedDoc.courseCode}</p>
                <p className="text-xs text-indigo-600">{selectedDoc.name}</p>
              </button>
            )}

            {Object.entries(PAST_QUESTIONS).map(([courseId, qs]) => {
              const isSelected = selectedDoc?.courseId === courseId
              return (
                <button
                  key={courseId}
                  onClick={() => isReadOnly ? promptLogin('take quizzes') : startQuiz(courseId)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'bg-white border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <p className="font-medium text-sm text-gray-900">{qs[0]?.courseCode || courseId}</p>
                  <p className="text-xs text-gray-400">{qs.length} questions available</p>
                </button>
              )
            })}

            {weakTopics.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-amber-700 mb-2">⚠ Weak areas to focus on:</p>
                {weakTopics.map((t, i) => (
                  <div key={i} className="text-xs text-gray-600 py-1 px-2 bg-amber-50 rounded-lg mb-1">
                    <span className="font-medium">{t.courseCode}</span> — {t.topic}
                    <span className="text-gray-400 ml-1">
                      ({t.correct}/{t.totalAttempts} correct, {Math.round((1 - t.correct / t.totalAttempts) * 100)}% weak)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'quiz' && currentQuestion && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                {currentQuestion.topic}
              </span>
              {currentQuestion.year && (
                <span className="text-xs text-gray-400">{currentQuestion.year}</span>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {currentIndex + 1}/{total}
              </span>
            </div>

            <p className="text-sm font-medium text-gray-900">{currentQuestion.question}</p>

            <div className="space-y-2">
              {currentQuestion.options.map((opt, i) => {
                let bg = 'bg-white border-gray-200 hover:border-indigo-300'
                if (showAnswer) {
                  if (i === currentQuestion.correctIndex) bg = 'bg-emerald-50 border-emerald-400 text-emerald-800'
                  else if (i === selectedAnswer && i !== currentQuestion.correctIndex) bg = 'bg-red-50 border-red-400 text-red-800'
                  else bg = 'bg-gray-50 border-gray-200 text-gray-400'
                } else if (selectedAnswer === i) {
                  bg = 'bg-indigo-50 border-indigo-300'
                }
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    disabled={showAnswer}
                    className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${bg}`}
                  >
                    <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </button>
                )
              })}
            </div>

            {showAnswer && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                <p className="text-xs font-medium text-indigo-800 mb-1">Explanation:</p>
                <p className="text-xs text-indigo-700">{currentQuestion.explanation}</p>
                {selectedAnswer !== currentQuestion.correctIndex && (
                  <p className="text-xs font-medium text-red-600 mt-2">
                    You answered {String.fromCharCode(65 + (selectedAnswer || 0))}. The correct answer is {String.fromCharCode(65 + currentQuestion.correctIndex)}.
                  </p>
                )}
              </div>
            )}

            {showAnswer && (
              <button
                onClick={nextQuestion}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium text-sm hover:shadow-md transition-all"
              >
                {currentIndex < total - 1 ? 'Next Question →' : 'See Results'}
              </button>
            )}

            <button
              onClick={() => { if (confirm('Quit this quiz? Your progress will be lost.')) { setView('select'); quizDb.getWeakTopics().then(setWeakTopics) } }}
              className="w-full py-2 rounded-xl bg-gray-50 text-gray-500 text-xs font-medium hover:bg-gray-100 transition-all"
            >
              Quit Quiz
            </button>

            <div className="flex justify-center gap-1">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i === currentIndex ? 'bg-indigo-500' :
                    i < (answers.length > 0 ? answers.findIndex(a => a.question.id === questions[currentIndex].id) : currentIndex)
                      ? (answers[i]?.correct ? 'bg-emerald-400' : 'bg-red-400')
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {view === 'result' && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 mb-2">
                {score}/{total}
              </div>
              <p className="text-sm text-gray-500">
                {score === total ? 'Perfect score! Excellent!' :
                 score >= total * 0.7 ? 'Great job! Keep it up.' :
                 score >= total * 0.5 ? 'Good effort. Review the weak areas.' :
                 'Keep practicing! Focus on the topics you missed.'}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">Question Review:</p>
              {answers.map((a, i) => (
                <div key={i} className={`text-xs p-2 rounded-lg border ${
                  a.correct ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                }`}>
                  <span className="font-medium">{a.question.topic}:</span>{' '}
                  {a.question.question.length > 60 ? a.question.question.slice(0, 60) + '...' : a.question.question}
                  <span className="ml-1">{a.correct ? '✓' : '✗'}</span>
                </div>
              ))}
            </div>

            {weakTopics.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-800 mb-1">Weak Areas Detected:</p>
                {weakTopics.map((t, i) => (
                  <p key={i} className="text-xs text-amber-700">
                    {t.courseCode} - {t.topic}: {Math.round((1 - t.correct / t.totalAttempts) * 100)}% error rate
                  </p>
                ))}
                <p className="text-xs text-amber-600 mt-2">
                  Tip: Open the AI Professor tab and ask it to explain these topics
                </p>
              </div>
            )}

            <button
              onClick={() => { setView('select'); quizDb.getWeakTopics().then(setWeakTopics) }}
              className="w-full py-3 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-all"
            >
              Back to Courses
            </button>
          </div>
        )}

        {view === 'performance' && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-700">Performance by Topic:</p>
            {weakTopics.length === 0 ? (
              <p className="text-xs text-gray-400">No performance data yet. Complete some quizzes first.</p>
            ) : (
              weakTopics.map((t, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-gray-900">{t.courseCode} — {t.topic}</span>
                    <span className="text-xs text-gray-400">{t.correct}/{t.totalAttempts}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        t.correct / t.totalAttempts >= 0.7 ? 'bg-emerald-500' :
                        t.correct / t.totalAttempts >= 0.4 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${(t.correct / t.totalAttempts) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
            <button
              onClick={() => setView('select')}
              className="w-full py-3 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-all"
            >
              Back to Courses
            </button>
          </div>
        )}
      </div>

      {view === 'select' && (
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => setView('performance')}
            className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-all"
          >
            View Performance Analytics
          </button>
        </div>
      )}
    </div>
  )
}
