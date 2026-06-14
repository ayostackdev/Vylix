'use client';

import { useEffect, useState } from 'react';
import { useBackupEmailPrompt } from '@/hooks/useBackupEmailPrompt';
import { BackupEmailModal } from '@/components/auth/BackupEmailModal';
import { ProfileBackupBanner } from '@/components/profile/ProfileBackupBanner';
import { ChatPanel } from '@/components/chat/ChatPanel';

const quickStats = [
  { label: 'Saved PDFs', value: '0' },
  { label: 'Available Offline', value: '0' },
  { label: 'Space Used', value: '0 MB' },
];

const recentItems = [
  { title: 'MTS 201 Tutorial Sheet', tag: 'PDF', state: 'Not cached yet' },
  { title: 'PHY 303 Past Questions', tag: 'Archive', state: 'Not cached yet' },
  { title: 'CSC 311 Lecture Notes', tag: 'Slides', state: 'Not cached yet' },
];

export function PrivateVaultView() {
  const [chatDocument, setChatDocument] = useState<{ id: string; title: string } | null>(null);
  const {
    showModal,
    checkAfterSave,
    closeModal,
    handleDismissed,
    handleSuccess,
  } = useBackupEmailPrompt();

  useEffect(() => {
    checkAfterSave();
  }, [checkAfterSave]);

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
          {quickStats.map((stat) => (
            <article
              key={stat.label}
              className="rounded-[1.5rem] border border-sky-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
            >
              <p className="cp-label">{stat.label}</p>
              <p className="mt-3 text-3xl font-black tracking-tight text-gray-900">
                {stat.value}
              </p>
            </article>
          ))}
        </div>

        <div className="rounded-[1.75rem] border border-sky-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h3 className="cp-card-title text-gray-900">Recent Vault Materials</h3>
            <span className="inline-flex rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px]">
              <span className="inline-flex rounded-full bg-white px-3 py-1 font-bold text-[11px] uppercase tracking-wider text-gray-900">
                Preview
              </span>
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {recentItems.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-2 rounded-[1.25rem] border border-sky-100 bg-blue-50 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-200 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="cp-card-title text-gray-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.state}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setChatDocument({ id: item.title, title: item.title })}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 hover:bg-blue-50 transition-colors"
                  >
                    💬 Chat
                  </button>
                  <span className="inline-flex rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 p-[1px] shadow-sm">
                    <span className="inline-flex rounded-full bg-white px-3 py-1 font-bold text-[11px] uppercase tracking-wider text-gray-900">
                      {item.tag}
                    </span>
                  </span>
                </div>
              </div>
            ))}
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
