'use client';

import { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { AIProfessorTab } from './tabs/AIProfessorTab'
import { StudyAgentTab } from './tabs/StudyAgentTab'
import { PracticeTab } from './tabs/PracticeTab'
import { OfflineVaultTab } from './tabs/OfflineVaultTab'
import { FlashcardTab } from './tabs/FlashcardTab'
import { TokenCounter } from '@/components/profile/TokenCounter'
import { useAuth } from '@/context/auth-context'
import type { DocumentInfo } from './ThreePanelLayout'

type TabId = 'professor' | 'practice' | 'vault' | 'agent' | 'cards'

interface InteractiveSidebarProps {
  selectedDoc: DocumentInfo | null
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  isReadOnly?: boolean
}

export function InteractiveSidebar({ selectedDoc, isOpen: controlledOpen, onOpenChange, isReadOnly = false }: InteractiveSidebarProps) {
  const { promptLogin } = useAuth()
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlledOpen ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen
  const [activeTab, setActiveTab] = useState<TabId>('professor')

  const tabConfig: { id: TabId; label: string; icon: JSX.Element }[] = [
    {
      id: 'professor',
      label: 'Tutor',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      id: 'practice',
      label: 'Quiz',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: 'cards',
      label: 'Cards',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      id: 'vault',
      label: 'Offline',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
    {
      id: 'agent',
      label: 'Agent',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ]

  return (
    <>
      {/* Mobile FAB when panel closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed right-4 z-50 w-12 h-12 rounded-2xl fab-premium text-white flex items-center justify-center md:hidden"
          style={{ bottom: 'max(5.5rem, env(safe-area-inset-bottom) + 4.5rem)' }}
          aria-label="Open tools"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </button>
      )}

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Panel */}
      <aside
        className={`${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } fixed right-0 top-0 bottom-0 w-full sm:w-[340px] md:w-[380px] xl:w-[420px] md:relative md:translate-x-0 z-40 flex flex-col sidebar-premium panel-glow-left transition-transform duration-300 ease-in-out h-full`}
      >
        {/* Mobile close bar */}
        <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] divider-premium md:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-sky-500 flex items-center justify-center shadow-sm shadow-blue-600/20">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">AI Tools</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-xl hover:bg-gray-100/80 active:bg-gray-200/60 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Active document banner */}
        {selectedDoc && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50/80 to-sky-50/40 border-b border-blue-100/50 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{selectedDoc.courseCode}</p>
                <p className="text-[11px] text-blue-500/80 truncate font-medium">{selectedDoc.name}</p>
              </div>
            </div>
          </div>
        )}

        <Tabs.Root
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabId)}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Premium tab bar */}
          <Tabs.List className="px-2 sm:px-3 py-2 shrink-0">
            <div className="tabbar-premium flex">
              {tabConfig.map((tab) => (
                <Tabs.Trigger
                  key={tab.id}
                  value={tab.id}
                  className={`tabbar-item flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2 min-h-[36px] sm:min-h-[38px] text-[10px] sm:text-[11px] font-semibold transition-all relative whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'is-active text-blue-700'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'
                  }`}
                >
                  {tab.icon}
                  <span className="text-[10px] sm:text-[11px]">{tab.label}</span>
                </Tabs.Trigger>
              ))}
              <div className="flex items-center pl-1">
                <TokenCounter />
              </div>
            </div>
          </Tabs.List>

          <div className="flex-1 min-h-0 overflow-hidden relative">
            <Tabs.Content value="professor" className="h-full"><AIProfessorTab selectedDoc={selectedDoc} isReadOnly={isReadOnly} /></Tabs.Content>
            <Tabs.Content value="practice" className="h-full"><PracticeTab selectedDoc={selectedDoc} isReadOnly={isReadOnly} /></Tabs.Content>
            <Tabs.Content value="cards" className="h-full"><FlashcardTab selectedDoc={selectedDoc} isReadOnly={isReadOnly} /></Tabs.Content>
            <Tabs.Content value="vault" className="h-full"><OfflineVaultTab selectedDoc={selectedDoc} isReadOnly={isReadOnly} /></Tabs.Content>
            <Tabs.Content value="agent" className="h-full"><StudyAgentTab selectedDoc={selectedDoc} isReadOnly={isReadOnly} /></Tabs.Content>

            {/* Read-only overlay */}
            {isReadOnly && (
              <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
                <div className="h-24 bg-gradient-to-t from-white via-white/95 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pointer-events-auto">
                  <button
                    onClick={() => promptLogin('unlock AI tools')}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white text-sm font-bold shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Sign In to Use AI Tools
                  </button>
                </div>
              </div>
            )}
          </div>
        </Tabs.Root>
      </aside>
    </>
  )
}
