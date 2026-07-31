'use client';

import { useState, useCallback } from 'react'
import { useAuth } from '@/context/auth-context'
import { useStudyAgent } from '@/queries/use-study-agent'
import { DailyLimitModal } from '@/components/profile/DailyLimitModal'
import type { DocumentInfo } from '../ThreePanelLayout'

interface Task {
  id: string
  step: number
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
}

interface StudyAgentTabProps {
  selectedDoc: DocumentInfo | null
  isReadOnly?: boolean
}

const AGENT_TASKS: Omit<Task, 'status'>[] = [
  { id: '1', step: 1, title: 'Connecting to Academic Agent', description: 'Initializing the Vylix study engine', },
  { id: '2', step: 2, title: 'Analyzing Your Performance', description: 'Checking quiz history and weak areas', },
  { id: '3', step: 3, title: 'Searching Course Materials', description: 'RAG search through relevant documents', },
  { id: '4', step: 4, title: 'Building Study Strategy', description: 'AI synthesizing a personalized plan', },
  { id: '5', step: 5, title: 'Generating Study Plan', description: 'Compiling actionable recommendations', },
]

export function StudyAgentTab({ selectedDoc, isReadOnly = false }: StudyAgentTabProps) {
  const { promptLogin } = useAuth()
  const agent = useStudyAgent()
  const [tasks, setTasks] = useState<Task[]>([])
  const [log, setLog] = useState<string[]>([])
  const [studyPlan, setStudyPlan] = useState<string | null>(null)
  const [showLimitModal, setShowLimitModal] = useState(false)

  const addLog = useCallback((message: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }, [])

  const animateTasks = useCallback(async (courseCode: string, docName: string) => {
    setTasks(AGENT_TASKS.map((t) => ({ ...t, status: 'pending' as const })))
    setLog([])
    setStudyPlan(null)

    for (const task of AGENT_TASKS) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: 'in_progress' } : t))
      addLog(`Starting: ${task.title}`)

      if (task.id === '1') {
        addLog(`Target course: ${courseCode}`)
        addLog(`Document: ${docName}`)
      } else if (task.id === '2') {
        addLog('Querying your answer history...')
        addLog('Identifying topics with highest failure rates')
      } else if (task.id === '3') {
        addLog('Searching vector store for relevant material...')
        addLog('Enriching query with course context')
      } else if (task.id === '4') {
        addLog('Gemini 2.5 Flash synthesizing personalized response...')
        addLog('Combining weakness data with course material')
      } else if (task.id === '5') {
        addLog('Formatting study plan with actionable steps')
      }

      await new Promise((r) => setTimeout(r, 800 + Math.random() * 600))
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: 'completed' } : t))
      addLog(`Done: ${task.title}`)
    }
  }, [addLog])

  const startAgent = useCallback(async () => {
    if (!selectedDoc) {
      addLog('No document selected')
      return
    }

    const courseCode = selectedDoc.courseCode || 'GENERAL'
    const docName = selectedDoc.name

    await animateTasks(courseCode, docName)

    addLog('Calling Vylix Academic Agent API...')

    try {
      const result = await agent.mutateAsync({
        courseCode,
        prompt: `Analyze my performance in ${courseCode} and create a personalized study plan. I want to improve my weak areas. Focus on the document: ${docName}`,
        taskTier: 'standard',
      })

      setStudyPlan(result.plan)
      addLog('Study plan received from the Academic Agent')
      addLog('Plan ready!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      addLog(`Agent error: ${msg}`)

      if (msg.includes('DAILY_LIMIT_REACHED')) {
        setShowLimitModal(true)
        addLog('Daily AI query limit reached. Upgrade to premium for more.')
        return
      }

      addLog('Falling back to local analysis...')

      const fallback = buildFallbackPlan(courseCode, docName)
      setStudyPlan(fallback)
      addLog('Fallback study plan ready')
    }
  }, [selectedDoc, agent, animateTasks, addLog])

  const handleStart = () => {
    if (isReadOnly) {
      promptLogin('use Study Agent')
      return
    }
    startAgent()
  }

  if (!selectedDoc) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-3 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
          <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Study Agent</h3>
          <p className="text-xs text-gray-400">Personalized study assistant</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center mx-auto mb-4 ring-1 ring-indigo-100/50">
              <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">Select a document first</p>
            <p className="text-xs text-gray-400 mt-1">The agent analyzes your material, quiz history, and course content</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="flex flex-col h-full bg-white">
      <div className="p-3 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Study Agent</h3>
            <p className="text-xs text-gray-400">{selectedDoc.courseCode} &middot; {selectedDoc.name}</p>
          </div>
          {tasks.length > 0 && !agent.isPending && (
            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {studyPlan ? 'Complete' : 'Ready'}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tasks.length === 0 && !studyPlan && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center mx-auto mb-4 ring-1 ring-indigo-100/50">
              <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">Ready to analyze {selectedDoc.courseCode}?</p>
            <p className="text-xs text-gray-400 mt-1 max-w-[240px] mx-auto">
              The agent will search your weaknesses, scan course materials, and create a personalized plan
            </p>
            <button
              onClick={handleStart}
              disabled={agent.isPending}
              className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium text-sm hover:shadow-md transition-all disabled:opacity-50"
            >
              {agent.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Agent Running...
                </span>
              ) : (
                'Start Agent'
              )}
            </button>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-2.5 rounded-xl text-sm border transition-all ${
                  task.status === 'in_progress' ? 'bg-indigo-50 border-indigo-200 animate-pulse' :
                  task.status === 'completed' ? 'bg-emerald-50 border-emerald-200' :
                  task.status === 'failed' ? 'bg-red-50 border-red-200' :
                  'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  task.status === 'completed' ? 'bg-emerald-500 text-white' :
                  task.status === 'in_progress' ? 'bg-indigo-500 text-white' :
                  'bg-gray-300 text-white'
                }`}>
                  {task.status === 'completed' ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : task.step}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-xs ${task.status === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>
                    {task.title}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">{task.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {studyPlan && (
          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-xs font-bold text-indigo-800">Your Personalized Study Plan</p>
            </div>
            <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
              {studyPlan}
            </div>
          </div>
        )}

        {log.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-3 mt-4">
            <p className="text-[10px] font-medium text-gray-400 mb-2 uppercase tracking-wider">Agent Log</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {log.map((entry, i) => (
                <p key={i} className="text-[11px] font-mono text-gray-300">{entry}</p>
              ))}
            </div>
          </div>
        )}

        {!agent.isPending && tasks.length > 0 && !studyPlan && (
          <button
            onClick={handleStart}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium text-sm hover:shadow-md transition-all"
          >
            Restart Agent
          </button>
        )}

        {studyPlan && !agent.isPending && (
          <div className="space-y-2">
            <button
              onClick={handleStart}
              className="w-full py-3 rounded-xl border border-indigo-200 bg-white text-indigo-600 font-medium text-sm hover:bg-indigo-50 transition-all"
            >
              Re-run Agent
            </button>
            <button
              onClick={() => { setTasks([]); setLog([]); setStudyPlan(null) }}
              className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium text-xs hover:bg-gray-200 transition-all"
            >
              Start over
            </button>
          </div>
        )}
      </div>
    </div>

      <DailyLimitModal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)} />
    </>
  )
}

function buildFallbackPlan(courseCode: string, docName: string): string {
  return `Study Plan for ${courseCode}

Session 1 — Core Concepts
- Review the key definitions and formulas from ${docName}
- Create summary flashcards for quick revision
- Focus on understanding, not memorization

Session 2 — Application
- Work through example problems
- Take a practice quiz in the app
- Review incorrect answers and identify patterns

Session 3 — Mastery
- Attempt past questions for ${courseCode}
- Focus on your weakest topics
- Explain concepts aloud (teach to learn)

Tip: Use the AI Tutor tab to ask questions about specific topics you struggle with.`
}
