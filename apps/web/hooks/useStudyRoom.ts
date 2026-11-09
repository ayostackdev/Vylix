'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getStudyRoomSocket, releaseStudyRoomSocket } from '@/lib/realtime';

export type StudyRoomStatus = 'idle' | 'connecting' | 'joined' | 'error';

export interface StudyRoomPeer {
  userId: string;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  hasVideo: boolean;
}

interface UseStudyRoomOptions {
  conversationId: string | null;
  userId: string;
  enabled: boolean;
}

interface ReadyPayload {
  iceServers?: RTCIceServer[];
  participants?: string[];
  maxParticipants?: number;
  maxVideoParticipants?: number;
}

interface PeerEventPayload {
  userId?: string;
  participants?: string[];
}

interface SdpPayload {
  from?: string;
  sdp?: RTCSessionDescriptionInit;
}

interface IcePayload {
  from?: string;
  candidate?: RTCIceCandidateInit;
}

interface ErrorPayload {
  code?: string;
  message?: string;
}

const DEFAULT_MAX_VIDEO_PARTICIPANTS = 4;

/**
 * Mesh WebRTC audio/video room scoped to an existing study group (conversation).
 * Signaling runs over the API WebSocket; media is peer-to-peer.
 *
 * Negotiation rule: for every pair of users, the one with the lexicographically
 * smaller id creates the offer. This makes the initiator deterministic when
 * both sides react to the same join event.
 *
 * A video m-line is reserved on every peer connection up front. Toggling the
 * camera then only needs `replaceTrack()` and never a renegotiation. Because
 * mesh video is bandwidth-heavy, cameras are limited to a smaller headcount
 * than the audio room (`maxVideoParticipants`, default 4).
 */
export function useStudyRoom({ conversationId, userId, enabled }: UseStudyRoomOptions) {
  const [status, setStatus] = useState<StudyRoomStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [peers, setPeers] = useState<Record<string, StudyRoomPeer>>({});
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [maxVideoParticipants, setMaxVideoParticipants] = useState(DEFAULT_MAX_VIDEO_PARTICIPANTS);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const mutedRef = useRef(false);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const videoEnabledRef = useRef(false);
  const participantsRef = useRef<string[]>([]);
  const maxVideoRef = useRef(DEFAULT_MAX_VIDEO_PARTICIPANTS);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const videoTransceiversRef = useRef(new Map<string, RTCRtpTransceiver>());

  const disableCamera = useCallback(() => {
    videoEnabledRef.current = false;
    setVideoEnabled(false);
    setLocalVideoStream(null);

    const track = videoTrackRef.current;
    videoTrackRef.current = null;
    if (track) {
      track.onended = null;
      track.stop();
    }

    videoTransceiversRef.current.forEach((transceiver) => {
      void transceiver.sender.replaceTrack(null).catch(() => {});
    });
  }, []);

  const enableCamera = useCallback(async () => {
    if (videoEnabledRef.current) return;

    if (participantsRef.current.length > maxVideoRef.current) {
      setError(`Video is limited to ${maxVideoRef.current} participants in this room.`);
      return;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 15, max: 20 },
          facingMode: 'user',
        },
      });

      const [track] = media.getVideoTracks();
      if (!track) {
        setError('No camera was found on this device.');
        return;
      }

      track.onended = () => disableCamera();
      videoTrackRef.current = track;
      videoEnabledRef.current = true;
      setVideoEnabled(true);
      setLocalVideoStream(new MediaStream([track]));
      setError(null);

      videoTransceiversRef.current.forEach((transceiver) => {
        void transceiver.sender.replaceTrack(track).catch(() => {});
      });
    } catch {
      setError('Camera access was denied. Check your browser permissions.');
    }
  }, [disableCamera]);

  const toggleVideo = useCallback(() => {
    if (videoEnabledRef.current) {
      disableCamera();
    } else {
      void enableCamera();
    }
  }, [disableCamera, enableCamera]);

  useEffect(() => {
    if (!conversationId || !userId || !enabled) {
      setStatus('idle');
      setParticipants([]);
      setPeers({});
      setLocalStream(null);
      setLocalVideoStream(null);
      setVideoEnabled(false);
      setError(null);
      participantsRef.current = [];
      videoEnabledRef.current = false;
      localStreamRef.current = null;
      return;
    }

    let cancelled = false;
    const socket = getStudyRoomSocket(conversationId);
    if (!socket) {
      setError('Realtime service is not configured.');
      setStatus('error');
      return;
    }

    const peerConnections = new Map<string, RTCPeerConnection>();
    const videoTransceivers = new Map<string, RTCRtpTransceiver>();
    const pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
    const remoteStreams = new Map<string, MediaStream>();
    peerConnectionsRef.current = peerConnections;
    videoTransceiversRef.current = videoTransceivers;

    let iceServers: RTCIceServer[] = [];

    const applyParticipants = (list: string[]) => {
      participantsRef.current = list;
      setParticipants(list);
      if (videoEnabledRef.current && list.length > maxVideoRef.current) {
        disableCamera();
        setError(
          `Video is limited to ${maxVideoRef.current} participants, so your camera was turned off.`
        );
      }
    };

    const updatePeer = (peerId: string, patch: Partial<StudyRoomPeer>) => {
      if (cancelled) return;
      setPeers((prev) => ({
        ...prev,
        [peerId]: {
          userId: peerId,
          stream: prev[peerId]?.stream ?? remoteStreams.get(peerId) ?? null,
          connectionState: prev[peerId]?.connectionState ?? 'new',
          hasVideo: prev[peerId]?.hasVideo ?? false,
          ...patch,
        },
      }));
    };

    const removePeer = (peerId: string) => {
      const pc = peerConnections.get(peerId);
      if (pc) {
        pc.close();
        peerConnections.delete(peerId);
      }
      videoTransceivers.delete(peerId);
      pendingCandidates.delete(peerId);
      remoteStreams.delete(peerId);
      if (cancelled) return;
      setPeers((prev) => {
        if (!(peerId in prev)) return prev;
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    };

    const send = (event: string, payload: Record<string, unknown>) => {
      socket.emit(event, payload);
    };

    const flushCandidates = async (peerId: string, pc: RTCPeerConnection) => {
      const queued = pendingCandidates.get(peerId);
      if (!queued) return;
      pendingCandidates.delete(peerId);
      for (const candidate of queued) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // Candidate raced ahead of the remote description; safe to drop.
        }
      }
    };

    const makeOffer = async (peerId: string, pc: RTCPeerConnection) => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send('rtc:offer', { target: peerId, sdp: pc.localDescription });
      } catch (err) {
        console.error('[Vylix] Failed to create WebRTC offer', err);
      }
    };

    const ensurePeer = (peerId: string, initiator: boolean): RTCPeerConnection => {
      const existing = peerConnections.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers });
      peerConnections.set(peerId, pc);
      updatePeer(peerId, { connectionState: pc.connectionState });

      const stream = localStreamRef.current;
      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !mutedRef.current;
          pc.addTrack(track, stream);
        });
      }

      const videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
      videoTransceivers.set(peerId, videoTransceiver);
      if (videoTrackRef.current) {
        void videoTransceiver.sender.replaceTrack(videoTrackRef.current).catch(() => {});
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          send('rtc:ice', { target: peerId, candidate: event.candidate.toJSON() });
        }
      };

      pc.ontrack = (event) => {
        let remoteStream = remoteStreams.get(peerId);
        if (!remoteStream) {
          remoteStream = event.streams[0] ?? new MediaStream();
          remoteStreams.set(peerId, remoteStream);
        }
        if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }

        if (event.track.kind === 'video') {
          const syncVideo = () => updatePeer(peerId, { hasVideo: !event.track.muted });
          syncVideo();
          event.track.addEventListener('mute', syncVideo);
          event.track.addEventListener('unmute', syncVideo);
          event.track.addEventListener('ended', syncVideo);
        }

        updatePeer(peerId, { stream: remoteStream });
      };

      pc.onconnectionstatechange = () => {
        updatePeer(peerId, { connectionState: pc.connectionState });
      };

      if (initiator) {
        void makeOffer(peerId, pc);
      }

      return pc;
    };

    const handleReady = (data?: ReadyPayload) => {
      iceServers = data?.iceServers ?? [];
      const maxVideo = data?.maxVideoParticipants ?? DEFAULT_MAX_VIDEO_PARTICIPANTS;
      maxVideoRef.current = maxVideo;
      setMaxVideoParticipants(maxVideo);
      applyParticipants(data?.participants ?? []);
      setStatus('joined');
      for (const peerId of data?.participants ?? []) {
        if (peerId === userId) continue;
        if (userId < peerId) ensurePeer(peerId, true);
      }
    };

    const handlePeerJoined = (data?: PeerEventPayload) => {
      const peerId = data?.userId;
      if (!peerId || peerId === userId) return;
      const list =
        data?.participants ??
        (participantsRef.current.includes(peerId)
          ? participantsRef.current
          : [...participantsRef.current, peerId]);
      applyParticipants(list);
      if (userId < peerId) ensurePeer(peerId, true);
    };

    const handlePeerLeft = (data?: PeerEventPayload) => {
      const peerId = data?.userId;
      if (!peerId) return;
      removePeer(peerId);
      applyParticipants(
        data?.participants ?? participantsRef.current.filter((id) => id !== peerId)
      );
    };

    const handleOffer = async (data?: SdpPayload) => {
      if (!data?.from || !data.sdp || data.from === userId) return;
      const peerId = data.from;
      const pc = ensurePeer(peerId, false);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await flushCandidates(peerId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send('rtc:answer', { target: peerId, sdp: pc.localDescription });
      } catch (err) {
        console.error('[Vylix] Failed to answer WebRTC offer', err);
      }
    };

    const handleAnswer = async (data?: SdpPayload) => {
      if (!data?.from || !data.sdp) return;
      const pc = peerConnections.get(data.from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await flushCandidates(data.from, pc);
      } catch (err) {
        console.error('[Vylix] Failed to apply WebRTC answer', err);
      }
    };

    const handleIce = async (data?: IcePayload) => {
      if (!data?.from || !data.candidate) return;
      const pc = peerConnections.get(data.from);
      if (!pc || !pc.remoteDescription) {
        const queued = pendingCandidates.get(data.from) ?? [];
        queued.push(data.candidate);
        pendingCandidates.set(data.from, queued);
        return;
      }
      try {
        await pc.addIceCandidate(data.candidate);
      } catch {
        // Late/duplicate candidate — ignore.
      }
    };

    const handleError = (data?: ErrorPayload) => {
      setError(data?.message ?? 'Could not join the study room.');
      setStatus('error');
    };

    const handleConnect = () => {
      if (cancelled) return;
      setStatus((current) => (current === 'joined' ? current : 'connecting'));
    };

    const handleDisconnect = (data?: { code?: number }) => {
      if (cancelled) return;
      peerConnections.forEach((pc) => pc.close());
      peerConnections.clear();
      videoTransceivers.clear();
      pendingCandidates.clear();
      remoteStreams.clear();
      setPeers({});
      setParticipants([]);

      // 4001 auth, 4003 not a member, 4004 room full — reconnecting cannot
      // fix these, so stop the socket instead of looping forever.
      if (data?.code === 4001 || data?.code === 4003 || data?.code === 4004) {
        setStatus('error');
        socket.disconnect();
        return;
      }

      setStatus('connecting');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('rtc:ready', handleReady);
    socket.on('rtc:peer-joined', handlePeerJoined);
    socket.on('rtc:peer-left', handlePeerLeft);
    socket.on('rtc:offer', handleOffer);
    socket.on('rtc:answer', handleAnswer);
    socket.on('rtc:ice', handleIce);
    socket.on('rtc:error', handleError);

    const start = async () => {
      setStatus('connecting');
      setError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        stream.getAudioTracks().forEach((track) => {
          track.enabled = !mutedRef.current;
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch {
        if (!cancelled) {
          setError('Microphone access is required to join a study room.');
          setStatus('error');
        }
        return;
      }

      if (cancelled) return;
      socket.connect();
    };

    void start();

    return () => {
      cancelled = true;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('rtc:ready', handleReady);
      socket.off('rtc:peer-joined', handlePeerJoined);
      socket.off('rtc:peer-left', handlePeerLeft);
      socket.off('rtc:offer', handleOffer);
      socket.off('rtc:answer', handleAnswer);
      socket.off('rtc:ice', handleIce);
      socket.off('rtc:error', handleError);
      videoTrackRef.current?.stop();
      videoTrackRef.current = null;
      videoEnabledRef.current = false;
      setVideoEnabled(false);
      setLocalVideoStream(null);
      peerConnections.forEach((pc) => pc.close());
      peerConnections.clear();
      videoTransceivers.clear();
      pendingCandidates.clear();
      remoteStreams.clear();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      peerConnectionsRef.current = new Map();
      videoTransceiversRef.current = new Map();
      releaseStudyRoomSocket(conversationId);
    };
  }, [conversationId, userId, enabled, disableCamera]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  }, []);

  return {
    status,
    error,
    participants,
    peers: Object.values(peers),
    muted,
    toggleMute,
    videoEnabled,
    toggleVideo,
    maxVideoParticipants,
    localStream,
    localVideoStream,
  };
}
