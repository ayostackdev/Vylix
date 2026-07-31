'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { ConversationList } from '@/components/chat/ConversationList';
import { ConversationView } from '@/components/chat/ConversationView';
import { NewConversationModal } from '@/components/chat/NewConversationModal';
import { ClassmateListModal } from '@/components/chat/ClassmateListModal';
import { useConversations, type ConversationDetail } from '@/queries/use-collaboration';

export function CollaborationView() {
  const { user } = useAuth();
  const { data: conversations } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showClassmates, setShowClassmates] = useState(false);
  const [showMobileList, setShowMobileList] = useState(true);

  const selectedConv = useMemo(() => {
    if (!selectedId || !conversations) return null;
    return conversations.find((c) => c.id === selectedId) ?? null;
  }, [selectedId, conversations]);

  const groupCount = conversations?.filter((c) => c.type === 'GROUP').length ?? 0;

  function conversationTitle(conv: {
    type: 'DIRECT' | 'GROUP';
    title: string | null;
    members: { role: string; user: { id: string; fullName: string } }[];
  }): string {
    if (conv.title) return conv.title;
    if (conv.type === 'DIRECT') {
      const other = conv.members.find((m) => m.user.id !== user?.id);
      return other?.user.fullName ?? 'Unknown';
    }
    return conv.members.map((m) => m.user.fullName).join(', ');
  }

  function otherParticipant(conv: {
    type: 'DIRECT' | 'GROUP';
    members: { role: string; user: { id: string; fullName: string; avatarUrl: string | null } }[];
  }): { id: string; fullName: string; avatarUrl: string | null } | undefined {
    if (conv.type !== 'DIRECT') return undefined;
    return conv.members.find((m) => m.user.id !== user?.id)?.user;
  }

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setShowMobileList(false);
  };

  const handleBack = () => {
    setShowMobileList(true);
  };

  const handleCreated = (conv: ConversationDetail) => {
    setSelectedId(conv.id);
    setShowMobileList(false);
  };

  return (
    <>
      <div className="flex flex-1 min-h-0 overflow-hidden rounded-[1.5rem] border border-indigo-100 bg-white shadow-[0_12px_30px_rgba(59,130,246,0.08)]">
        <div className={`w-full border-r border-indigo-100 lg:w-80 lg:block ${showMobileList ? 'block' : 'hidden'}`}>
          <ConversationList
            selectedId={selectedId}
            onSelect={handleSelect}
            onCreateNew={() => setShowNewModal(true)}
            onClassmates={() => setShowClassmates(true)}
          />
        </div>

        <div className={`flex-1 lg:block ${!showMobileList ? 'block' : 'hidden'}`}>
          {selectedConv ? (
            <ConversationView
              conversationId={selectedConv.id}
              title={conversationTitle(selectedConv)}
              otherUser={otherParticipant(selectedConv)}
              onBack={handleBack}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center px-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center mx-auto mb-4 ring-1 ring-indigo-100/50">
                  <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-gray-900">Your Messages</h3>
                <p className="mt-2 text-sm text-gray-600 max-w-xs mx-auto">
                  Select a conversation or start a new one to chat with classmates
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-5">
                  <button
                    onClick={() => setShowClassmates(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Find Classmates
                  </button>
                  <button
                    onClick={() => setShowNewModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    New Chat
                  </button>
                </div>
                {groupCount > 0 && (
                  <p className="mt-3 text-[10px] text-gray-400 font-medium">
                    {groupCount} study group{groupCount !== 1 ? 's' : ''} active
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <NewConversationModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={handleCreated}
      />

      <ClassmateListModal
        isOpen={showClassmates}
        onClose={() => setShowClassmates(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
