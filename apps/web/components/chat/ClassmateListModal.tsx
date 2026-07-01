'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import { useClassmates, useCreateConversation, type ConversationDetail } from '@/queries/use-collaboration';

interface ClassmateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (conv: ConversationDetail) => void;
}

export function ClassmateListModal({ isOpen, onClose, onCreated }: ClassmateListModalProps) {
  const { user } = useAuth();
  const { data: classmates, isLoading } = useClassmates();
  const createConversation = useCreateConversation();

  if (!isOpen) return null;

  const handleStartChat = async (classmate: { id: string; fullName: string }) => {
    try {
      const conv = await createConversation.mutateAsync({
        type: 'DIRECT',
        memberIds: [classmate.id],
      });
      onCreated(conv);
      onClose();
    } catch {
      // handled by mutation
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-blue-100 flex flex-col max-h-[80vh]">
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-emerald-50/35 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-gray-900">Classmates</h2>
              <p className="text-sm text-gray-600 mt-1">
                {user?.departmentName ?? 'Your department'} &middot; {user?.currentLevel ?? ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-blue-50 transition"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-32 rounded bg-slate-200" />
                    <div className="h-3 w-20 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : !classmates || classmates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-3xl mb-3">👥</span>
              <p className="text-sm font-semibold text-gray-700">No classmates found</p>
              <p className="text-xs text-gray-500 mt-1">
                Make sure your department and level are set in your profile
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {classmates.map((cm) => (
                <button
                  key={cm.id}
                  onClick={() => handleStartChat(cm)}
                  disabled={createConversation.isPending}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-blue-50 transition disabled:opacity-50"
                >
                  <Avatar className="h-10 w-10 shrink-0 shadow-sm ring-2 ring-blue-100">
                    <AvatarImage src={cm.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-green-50 font-bold text-gray-900 text-sm">
                      {cm.fullName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{cm.fullName}</p>
                    <p className="text-xs text-gray-500">
                      {cm.department?.code ?? ''}{cm.matricNumber ? ` · ${cm.matricNumber}` : ''}
                    </p>
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8m-4-4l4 4-4 4" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
