'use client';

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { offlineStore } from '@/lib/offline-store'
import { getVaultMaterials, deleteVaultMaterial, type VaultMaterial } from '@/lib/vault-store'
import type { DocumentInfo } from '../ThreePanelLayout'

interface OfflineVaultTabProps {
  selectedDoc: DocumentInfo | null
  isReadOnly?: boolean
}

interface CachedDoc {
  name: string
  courseId: string
  courseCode: string
  savedAt: number
}

export function OfflineVaultTab({ selectedDoc, isReadOnly = false }: OfflineVaultTabProps) {
  const [cachedDocs, setCachedDocs] = useState<CachedDoc[]>([])
  const [vaultMaterials, setVaultMaterials] = useState<VaultMaterial[]>([])
  const [storageUsage, setStorageUsage] = useState<string>('')
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const loadData = async () => {
    try {
      const mats = await getVaultMaterials()
      setVaultMaterials(mats)
    } catch { toast.error('Failed to load vault materials'); }

    try {
      const estimate = await offlineStore.getStorageEstimate()
      if (estimate.usage && estimate.quota) {
        const used = (estimate.usage / (1024 * 1024)).toFixed(1)
        const total = (estimate.quota / (1024 * 1024)).toFixed(1)
        setStorageUsage(`${used} MB / ${total} MB`)
      }
    } catch { toast.error('Failed to load storage info'); }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleDelete = async (id: string) => {
    const updated = await deleteVaultMaterial(id)
    setVaultMaterials(updated)
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-3 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
        <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Offline Vault</h3>
        <div className="flex items-center gap-2 mt-1">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
            isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {storageUsage && (
            <span className="text-[10px] text-gray-400">{storageUsage}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!isOnline && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-medium text-amber-800">You&apos;re offline</p>
            <p className="text-xs text-amber-600 mt-1">
              You can still access your saved materials and chat history.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Saved Materials</p>
          {vaultMaterials.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">📦</div>
              <p className="text-xs text-gray-400">No materials saved offline yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Click &quot;Save Offline&quot; on any document to access it without internet
              </p>
            </div>
          ) : (
            vaultMaterials.map((mat) => (
              <div
                key={mat.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200"
              >
                <div className="w-8 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  PDF
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{mat.fileName || mat.title}</p>
                  <p className="text-[10px] text-gray-400">
                    {mat.fileType?.toUpperCase() || 'PDF'} · Saved offline
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(mat.id)}
                  className="text-[10px] text-red-500 hover:text-red-700 p-1"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 mt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Actions</p>
          <button
            onClick={loadData}
            className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition-all"
          >
            Refresh Vault
          </button>
          <button
            onClick={async () => {
              await offlineStore.clearDocumentCache()
              loadData()
            }}
            className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-all"
          >
            Clear Cache
          </button>
        </div>

        {vaultMaterials.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-4">
            <p className="text-xs font-medium text-blue-800">💡 Offline Tip</p>
            <p className="text-xs text-blue-700 mt-1">
              Materials in the vault are stored on your device.               They&apos;re available even without internet —
              perfect for studying on campus during network outages or low data.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
