'use client';

import { useState, useCallback, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { offlineStore } from '@/lib/offline-store'
import { getCourseById } from '@/lib/departments'
import type { DocumentInfo } from './ThreePanelLayout'
import { PdfViewerInline } from './PdfViewerInline'
import { DriveSyncBanner } from './DriveSyncBanner'
import { useDrive } from '@/context/drive-context'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'

interface Material {
  id: string
  file_name: string
  file_url: string
  file_size: number
  topic_id: string
  processing_status: string
  uploaded_at: string | null
}

interface MainContentPanelProps {
  selectedCourseId: string | null
  selectedDoc: DocumentInfo | null
  onSelectDoc: (doc: DocumentInfo | null) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MainContentPanel({ selectedCourseId, selectedDoc, onSelectDoc }: MainContentPanelProps) {
  const { connectDrive, driveConnected } = useDrive()
  const [documents, setDocuments] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [offlineStatus] = useState<'online' | 'offline'>(
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline'
  )

  const course = selectedCourseId ? getCourseById(selectedCourseId) : null

  const fetchMaterials = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      const res = await fetch(`${API_BASE}/api/materials/my-materials`, { headers })
      if (res.ok) {
        const data = await res.json()
        setDocuments(data)
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials])

  const handleSelectDoc = useCallback((doc: Material) => {
    onSelectDoc({
      id: doc.id,
      name: doc.file_name,
      courseId: selectedCourseId || '',
      courseCode: course?.code || '',
    })
  }, [onSelectDoc, selectedCourseId, course])

  const handleSaveOffline = useCallback(async () => {
    if (!selectedDoc) return
    setSaving(true)
    try {
      await offlineStore.cacheDocument(selectedDoc.id, { name: selectedDoc.name, courseId: selectedDoc.courseId, courseCode: selectedDoc.courseCode, savedAt: Date.now() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }, [selectedDoc])

  const handleViewPdf = useCallback(async (materialId: string) => {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      const res = await fetch(`${API_BASE}/api/materials/${materialId}/file`, { headers })
      if (!res.ok) throw new Error('Failed to get file')
      const { download_url } = await res.json()
      setViewerUrl(download_url)
    } catch {
      // Failed to load PDF
    }
  }, [])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      if (res.ok) {
        await fetchMaterials()
      }
    } catch {
      // Upload failed
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }, [fetchMaterials])

  return (
    <main className="flex-1 flex flex-col min-w-0 h-full">
      {/* Premium header */}
      <header className="header-premium flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xs sm:text-base font-bold text-gray-900 truncate tracking-tight">
            {selectedDoc ? selectedDoc.name : (course ? `${course.code} — ${course.title}` : 'All Documents')}
          </h1>
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-400 mt-0.5">
            <span className="font-medium truncate">{selectedDoc ? course?.code : `${documents.length} documents`}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0" />
            <span className={`inline-flex items-center gap-1.5 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold shrink-0 ${
              offlineStatus === 'online'
                ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60'
                : 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/60'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full status-dot ${offlineStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ background: offlineStatus === 'online' ? '#10b981' : '#f59e0b' }} />
              {offlineStatus}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {selectedDoc && (
            <button
              onClick={handleSaveOffline}
              disabled={saving || saved}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-gray-50/80 border border-gray-200/80 text-gray-700 font-semibold hover:bg-white hover:border-gray-300 hover:shadow-sm disabled:opacity-50 transition-all duration-200"
            >
              {saved ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </>
              ) : saving ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save Offline
                </>
              )}
            </button>
          )}
          <label className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs px-2.5 sm:px-3 py-2 rounded-xl bg-gray-50/80 border border-gray-200/80 text-gray-700 font-semibold hover:bg-white hover:border-gray-300 hover:shadow-sm cursor-pointer transition-all duration-200 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            <span className="hidden xs:inline">{uploading ? 'Uploading...' : 'Upload'}</span>
            <span className="xs:hidden">{uploading ? '...' : '+'}</span>
            <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
          </label>
          <button
            onClick={connectDrive}
            className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs px-2 sm:px-3 py-2 rounded-xl font-semibold btn-glow hover:shadow-lg min-h-[36px] sm:min-h-[38px] transition-all duration-200 ${
              driveConnected
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60 hover:bg-emerald-100'
                : 'bg-gradient-to-r from-blue-500 to-emerald-500 text-white hover:shadow-lg'
            }`}
          >
            {driveConnected ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.71 3.5L1.15 15l3.43 6h13.72l3.42-6L15.29 3.5H7.71zm4.58 2.28l4.14 7.22H4.71l4.14-7.22h3.44z" opacity="0.9" />
              </svg>
            )}
            <span className="hidden sm:inline">{driveConnected ? 'Google Drive Connected' : 'Google Drive'}</span>
            <span className="sm:hidden">{driveConnected ? '✓' : 'Drive'}</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5">
        {viewerUrl ? (
          <PdfViewerInline fileUrl={viewerUrl} onClose={() => { setViewerUrl(null) }} />
        ) : selectedDoc ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 premium-fade-in">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-50 to-emerald-50 flex items-center justify-center mb-4 ring-1 ring-blue-100/50">
              <svg className="w-10 h-10 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-gray-700 mb-1">Ready to read</h3>
            <p className="text-xs text-gray-400 max-w-xs">Click <strong className="text-blue-500">View</strong> on a document to start reading, or chat with AI about it.</p>
          </div>
        ) : (
          <div>
            {/* Drive sync banner for new users */}
            {!selectedCourseId && <DriveSyncBanner />}

            {/* Section header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                  {course ? `${course.code} Materials` : 'Recent Documents'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">
                  {course ? course.title : 'Browse your uploaded course materials'}
                </p>
              </div>
            </div>

            {/* Document grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex items-center gap-3 text-gray-400">
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm font-medium">Loading documents...</span>
                </div>
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4 premium-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-50 to-emerald-50 flex items-center justify-center mb-5 ring-1 ring-blue-100/50">
                  <svg className="w-10 h-10 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1.5">No documents yet</h3>
                <p className="text-sm text-gray-400 max-w-sm mb-6 leading-relaxed">
                  {driveConnected
                    ? 'Your Drive is connected but no documents have been imported yet. Import files from your Drive or upload directly.'
                    : 'Connect your Google Drive to automatically import your course materials, or upload PDFs directly.'}
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  {!driveConnected && (
                    <button
                      onClick={connectDrive}
                      className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-bold btn-glow hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.71 3.5L1.15 15l3.43 6h13.72l3.42-6L15.29 3.5H7.71zm4.58 2.28l4.14 7.22H4.71l4.14-7.22h3.44z" opacity="0.9" />
                      </svg>
                      Connect Google Drive
                    </button>
                  )}
                  <label className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 hover:shadow-sm cursor-pointer transition-all duration-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload PDF
                    <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
                  </label>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 premium-stagger">
                {documents.map((doc) => (
                  <div key={doc.id} className="doc-card group">
                    <div className="p-3.5 sm:p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-12 rounded-xl bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm shadow-red-400/20 group-hover:shadow-md group-hover:shadow-red-400/30 transition-shadow duration-300">
                          PDF
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs sm:text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">{doc.file_name}</h3>
                          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-400 mt-1">
                            <span className="font-medium">{formatFileSize(doc.file_size)}</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                            <span>{formatDate(doc.uploaded_at)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100/80">
                        <button
                          onClick={() => { handleSelectDoc(doc); handleViewPdf(doc.id) }}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-semibold text-blue-600 hover:text-white px-3 py-2 rounded-lg hover:bg-blue-500 transition-all duration-200"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </button>
                        <button
                          onClick={() => handleSelectDoc(doc)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-semibold text-emerald-600 hover:text-white px-3 py-2 rounded-lg hover:bg-emerald-500 transition-all duration-200"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Chat
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Upload placeholder card */}
                <label className="doc-card group cursor-pointer border-dashed !border-gray-200 hover:!border-blue-300">
                  <div className="p-3.5 sm:p-4 flex flex-col items-center justify-center min-h-[140px]">
                    <div className="w-10 h-10 rounded-2xl bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center mb-2 transition-colors duration-200">
                      <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <p className="text-[11px] font-semibold text-gray-400 group-hover:text-blue-500 transition-colors">Upload PDF</p>
                    <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
                  </div>
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
