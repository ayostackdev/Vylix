'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { useBackupEmailPrompt } from '@/hooks/useBackupEmailPrompt';
import { BackupEmailModal } from '@/components/auth/BackupEmailModal';
import { ProfileBackupBanner } from '@/components/profile/ProfileBackupBanner';
import { ChatPanel } from '@/components/chat/ChatPanel';

interface VaultMaterial {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  processingStatus: string;
  uploadedAt: string;
  topic: { title: string } | null;
}

export function PrivateVaultView({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<VaultMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatDocument, setChatDocument] = useState<{ id: string; title: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const {
    showModal,
    checkAfterSave,
    closeModal,
    handleDismissed,
    handleSuccess,
  } = useBackupEmailPrompt();

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${apiBaseUrl}/api/materials/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to delete');

      setItems((prev) => prev.filter((item) => item.id !== id));
      setConfirmDeleteId(null);
    } catch {}
    setDeletingId(null);
  }, []);

  const openFile = useCallback(async (id: string) => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${apiBaseUrl}/api/materials/${id}/file`, { headers });
      if (!res.ok) throw new Error('Failed to get file');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {}
  }, []);

  const fetchVault = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const res = await fetch(`${apiBaseUrl}/api/materials/my-materials?limit=50`, { headers });
      if (!res.ok) throw new Error('Failed to fetch vault materials');
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVault();
    checkAfterSave();
  }, [fetchVault, checkAfterSave, refreshKey]);

  const totalSize = items.reduce((acc, i) => acc + (i.fileSize || 0), 0);
  const sizeMb = totalSize > 0 ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB` : '0 MB';
  const stats = [
    { label: 'Saved PDFs', value: String(items.length) },
    { label: 'Available Offline', value: '0' },
    { label: 'Space Used', value: sizeMb },
  ];

  return (
    <>
      <ProfileBackupBanner />
      <section className="space-y-5 rounded-[1.75rem] border border-sky-100 bg-blue-50 p-4 shadow-[0_16px_40px_rgba(59,130,246,0.08)] sm:space-y-8 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px] shadow-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 font-bold text-[11px] uppercase tracking-wider text-gray-900">
                Secure workspace
              </span>
            </div>
            <h2 className="text-[clamp(1.5rem,3vw,2.2rem)] leading-[1.2] tracking-[-0.03em] font-black bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent mb-3">
              Private Vault
            </h2>
            <p className="cp-body max-w-2xl sm:text-base">
              Your personal offline library for zero-interruption study sessions.
              Materials cached and ready when campus network drops.
            </p>
          </div>
          <span className="inline-flex rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px] shadow-sm">
            <span className="inline-flex rounded-full bg-white px-3 py-1 font-bold text-[11px] uppercase tracking-wider text-gray-900">
              Offline-ready
            </span>
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className="rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
            >
              <p className="cp-label">{stat.label}</p>
              <p className="mt-3 text-3xl font-black tracking-tight text-gray-900">
                {loading ? '...' : stat.value}
              </p>
            </article>
          ))}
        </div>

        <div className="rounded-[1.75rem] border border-sky-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h3 className="cp-card-title text-gray-900">Recent Vault Materials</h3>
          </div>

          <div className="mt-5 grid gap-3">
            {loading ? (
              <p className="text-sm text-slate-400">Loading...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-400">No materials yet. Upload from the Past Questions tab.</p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-[1.25rem] border border-sky-100 bg-blue-50 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-200 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="cp-card-title text-gray-900">{item.fileName}</p>
                    <p className="text-xs text-slate-500">{item.topic?.title ?? ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openFile(item.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setChatDocument({ id: item.id, title: item.fileName })}
                      className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      Chat
                    </button>
                    {confirmDeleteId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {deletingId === item.id ? '...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={deletingId === item.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {chatDocument && (
            <ChatPanel
              documentId={chatDocument.id}
              documentTitle={chatDocument.title}
              onClose={() => setChatDocument(null)}
            />
          )}
        </div>
      </section>

      <BackupEmailModal
        isOpen={showModal}
        onClose={closeModal}
        onDismiss={handleDismissed}
        onSuccess={handleSuccess}
      />
    </>
  );
}
