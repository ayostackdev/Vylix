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
      <div className="flex flex-1 min-h-0 overflow-hidden rounded-[1.5rem] border border-blue-100 bg-white shadow-[0_12px_30px_rgba(59,130,246,0.08)]">
        <div className={`w-full border-r border-blue-100 lg:w-80 lg:block ${showMobileList ? 'block' : 'hidden'}`}>
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
              <div className="text-center">
                <span className="text-5xl">💬</span>
                <h3 className="mt-4 text-xl font-black text-gray-900">Your Messages</h3>
                <p className="mt-2 text-sm text-gray-600 max-w-xs">
                  Select a conversation or start a new one to chat with classmates
                </p>
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
