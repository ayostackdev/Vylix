'use client';

import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/auth-context';
import { useStudyRoom } from '@/hooks/useStudyRoom';
import { captureEvent } from '@/lib/posthog';

interface StudyRoomMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface StudyRoomPanelProps {
  conversationId: string;
  title: string;
  members: StudyRoomMember[];
  onClose: () => void;
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    element.srcObject = stream;
    void element.play().catch(() => {});
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}

function VideoPreview({
  stream,
  muted = false,
  mirrored = false,
}: {
  stream: MediaStream;
  muted?: boolean;
  mirrored?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    element.srcObject = stream;
    void element.play().catch(() => {});
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
    />
  );
}

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function StudyRoomPanel({ conversationId, title, members, onClose }: StudyRoomPanelProps) {
  const { user } = useAuth();
  const {
    status,
    error,
    participants,
    peers,
    muted,
    toggleMute,
    videoEnabled,
    toggleVideo,
    maxVideoParticipants,
    localVideoStream,
  } = useStudyRoom({
    conversationId,
    userId: user?.id ?? '',
    enabled: Boolean(user),
  });

  const memberMap = new Map(members.map((member) => [member.id, member]));
  const peerMap = new Map(peers.map((peer) => [peer.userId, peer]));
  const selfId = user?.id ?? '';

  const joinTrackedRef = useRef(false);
  const cameraTrackedRef = useRef(false);

  useEffect(() => {
    if (status === 'joined' && !joinTrackedRef.current) {
      joinTrackedRef.current = true;
      captureEvent('study_room_joined', { conversation_id: conversationId });
    }
  }, [status, conversationId]);

  useEffect(() => {
    if (videoEnabled && !cameraTrackedRef.current) {
      cameraTrackedRef.current = true;
      captureEvent('study_room_camera_enabled', { conversation_id: conversationId });
    }
  }, [videoEnabled, conversationId]);

  const visibleParticipants = participants.length > 0 ? participants : selfId ? [selfId] : [];
  const videoAtCapacity =
    !videoEnabled && participants.length > 0 && participants.length > maxVideoParticipants;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl">
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50/35 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-900">Study Room</h2>
              <p className="mt-0.5 text-sm text-gray-600">{title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-2xl leading-none text-gray-500 transition-colors hover:text-gray-700"
              title="Close"
              aria-label="Close study room"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="mb-4 flex items-center justify-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                status === 'joined'
                  ? 'animate-pulse bg-emerald-500'
                  : status === 'error'
                    ? 'bg-red-500'
                    : 'bg-amber-400'
              }`}
            />
            <span className="text-xs font-semibold text-gray-600">
              {status === 'joined'
                ? 'Connected'
                : status === 'error'
                  ? 'Room unavailable'
                  : 'Connecting…'}
            </span>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visibleParticipants.map((participantId) => {
              const isSelf = participantId === selfId;
              const member = memberMap.get(participantId);
              const name = isSelf ? (user?.fullName ?? 'You') : (member?.fullName ?? 'Classmate');
              const avatarUrl = isSelf ? user?.avatarUrl : (member?.avatarUrl ?? undefined);
              const peer = peerMap.get(participantId);
              const videoStream = isSelf ? localVideoStream : (peer?.stream ?? null);
              const hasVideo = (isSelf ? videoEnabled : Boolean(peer?.hasVideo)) && Boolean(videoStream);
              const connectionLabel = isSelf
                ? muted
                  ? 'Muted'
                  : 'You'
                : peer?.connectionState === 'connected'
                  ? 'Connected'
                  : peer?.connectionState === 'failed'
                    ? 'Connection failed'
                    : 'Connecting…';

              return (
                <div
                  key={participantId}
                  className="flex flex-col items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/40 px-3 py-4"
                >
                  <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-blue-100 to-sky-50">
                    {hasVideo ? (
                      <VideoPreview
                        stream={videoStream as MediaStream}
                        muted={isSelf}
                        mirrored={isSelf}
                      />
                    ) : (
                      <Avatar className="h-12 w-12 shadow-sm ring-2 ring-white">
                        <AvatarImage src={avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-green-50 text-sm font-bold text-gray-900">
                          {initials(name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    {isSelf && (
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        You
                      </span>
                    )}
                  </div>
                  <span className="w-full truncate text-center text-xs font-bold text-gray-800">
                    {name}
                  </span>
                  <span
                    className={`text-[10px] font-medium ${
                      peer?.connectionState === 'failed' ? 'text-red-500' : 'text-gray-500'
                    }`}
                  >
                    {connectionLabel}
                  </span>
                  {!isSelf && peer?.stream && <RemoteAudio stream={peer.stream} />}
                </div>
              );
            })}
          </div>

          {status === 'joined' && visibleParticipants.length <= 1 && (
            <p className="mt-4 text-center text-xs text-gray-500">
              Waiting for classmates to join. Share the study group to invite them.
            </p>
          )}

          {videoAtCapacity && (
            <p className="mt-4 text-center text-xs text-gray-500">
              Camera is limited to {maxVideoParticipants} people in this room
              ({participants.length} connected). Audio still works for everyone.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={toggleMute}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
                muted
                  ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                  : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50'
              }`}
            >
              {muted ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              )}
              {muted ? 'Unmute' : 'Mute'}
            </button>

            <button
              onClick={toggleVideo}
              disabled={videoAtCapacity}
              title={
                videoAtCapacity
                  ? `Camera is limited to ${maxVideoParticipants} people in this room`
                  : videoEnabled
                    ? 'Turn camera off'
                    : 'Turn camera on'
              }
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                videoEnabled
                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50'
              }`}
            >
              {videoEnabled ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
              {videoEnabled ? 'Camera off' : 'Camera'}
            </button>

            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:shadow-lg"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l-8 8m0-8l8 8M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
