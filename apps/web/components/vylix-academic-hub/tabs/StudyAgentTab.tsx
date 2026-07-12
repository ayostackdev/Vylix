'use client';

import { useState, useEffect, useCallback } from 'react'
import { offlineStore } from '@/lib/offline-store'
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
}

export function StudyAgentTab({ selectedDoc }: StudyAgentTabProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [studyPlan, setStudyPlan] = useState<string | null>(null)

  const INITIAL_TASKS: Task[] = [
    { id: '1', step: 1, title: 'Scanning Course Material', description: 'Reading the document to understand key topics', status: 'pending' },
    { id: '2', step: 2, title: 'Analyzing Past Performance', description: 'Checking your quiz history for weak areas', status: 'pending' },
    { id: '3', step: 3, title: 'Building Study Strategy', description: 'Creating a personalized study plan based on the material', status: 'pending' },
    { id: '4', step: 4, title: 'Extracting Key Concepts', description: 'Identifying core topics and important formulas', status: 'pending' },
    { id: '5', step: 5, title: 'Generating Practice Sets', description: 'Creating quiz questions and practice exercises', status: 'pending' },
  ]

  const addLog = (message: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const simulateAgent = useCallback(async () => {
    setIsRunning(true)
    setStudyPlan(null)
    setTasks(INITIAL_TASKS.map((t) => ({ ...t, status: 'pending' })))
    setLog([])

    const courseCode = selectedDoc?.courseCode || 'selected course'
    const docName = selectedDoc?.name || 'material'

    for (const task of INITIAL_TASKS) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: 'in_progress' } : t))
      addLog(`Starting: ${task.title}`)

      await new Promise((r) => setTimeout(r, 1200))

      if (task.id === '1') {
        addLog(`📄 Opened "${docName}"`)
        addLog(`📊 Detected topics: ${courseCode} course material`)
      } else if (task.id === '2') {
        try {
          const weakTopics = await (await import('@/lib/quiz-store')).quizDb.getWeakTopics()
          if (weakTopics.length > 0) {
            addLog(`⚠ Found ${weakTopics.length} weak topic(s): ${weakTopics.map(t => t.topic).join(', ')}`)
          } else {
            addLog('✓ No weak areas detected yet. Start with fresh practice.')
          }
        } catch {
          addLog('ℹ No previous quiz data available for this course')
        }
      } else if (task.id === '3') {
        addLog('🎯 Building personalized study strategy...')
        addLog(`📅 Recommended: Study ${courseCode} in 3 sessions this week`)
      } else if (task.id === '4') {
        addLog('🔍 Extracting formulas, definitions, and key theorems')
        addLog('📝 Creating summary notes for quick revision')
      } else if (task.id === '5') {
        addLog('✏ Generating 5 practice questions based on the material')
      }

      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: 'completed' } : t))
      addLog(`✓ Completed: ${task.title}`)
    }

    const plan = `📚 **Study Plan for ${courseCode}**

**Session 1 — Core Concepts**
- Review the key definitions and formulas
- Read through ${docName} actively
- Create summary flashcards

**Session 2 — Application**
- Work through example problems
- Take the Practice quiz in this app
- Review incorrect answers with AI Professor

**Session 3 — Mastery**
- Attempt past questions (${courseCode})
- Focus on weak areas identified in Practice
- Teach a classmate to solidify understanding`

    setStudyPlan(plan)
    addLog('✅ Study plan ready!')
    setIsRunning(false)
  }, [selectedDoc])

  const startAgent = () => {
    if (!selectedDoc) {
      addLog('⚠ Please select a document first to start the study agent.')
      setLog(['[System] Select a document from the library, then click "Start Agent"'])
      return
    }
    simulateAgent()
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
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-sm text-gray-500">Select a document from the library</p>
            <p className="text-xs text-gray-400 mt-1">The agent will analyze your material and create a study plan</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-3 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
        <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Study Agent</h3>
        <p className="text-xs text-gray-400">Analyzing: {selectedDoc.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tasks.length === 0 && !isRunning && !studyPlan && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-sm font-medium text-gray-700">Ready to study {selectedDoc.courseCode}?</p>
            <p className="text-xs text-gray-400 mt-1">
              The agent will analyze your document and quiz history, then create a personalized study plan
            </p>
            <button
              onClick={startAgent}
              className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-medium text-sm hover:shadow-md transition-all"
            >
              Start Agent
            </button>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-2.5 rounded-xl text-sm border transition-all ${
                  task.status === 'in_progress' ? 'bg-blue-50 border-blue-200 animate-pulse' :
                  task.status === 'completed' ? 'bg-emerald-50 border-emerald-200' :
                  task.status === 'failed' ? 'bg-red-50 border-red-200' :
                  'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  task.status === 'completed' ? 'bg-emerald-500 text-white' :
                  task.status === 'in_progress' ? 'bg-blue-500 text-white' :
                  'bg-gray-300 text-white'
                }`}>
                  {task.status === 'completed' ? '✓' : task.step}
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
          <div className="bg-gradient-to-br from-blue-50 to-emerald-50 border border-blue-200 rounded-xl p-4 mt-4">
            <p className="text-xs font-bold text-blue-800 mb-2">📋 Your Study Plan</p>
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

        {!isRunning && tasks.length > 0 && !studyPlan && (
          <button
            onClick={startAgent}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-medium text-sm hover:shadow-md transition-all"
          >
            Restart Agent
          </button>
        )}
      </div>
    </div>
  )
}
