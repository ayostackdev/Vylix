import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, Socket } from 'socket.io';

export type RealtimeRoomType = 'department' | 'topic' | 'conversation' | 'user';

export type PulseEventKind =
  | 'upload'
  | 'comment'
  | 'lesson'
  | 'notification'
  | 'message'
  | 'typing'
  | 'read'
  | 'edit'
  | 'delete'
  | 'presence'
  | 'status';

export interface PulseEvent<TPayload = Record<string, unknown>> {
  roomType: RealtimeRoomType;
  roomKey: string;
  kind: PulseEventKind;
  title: string;
  message?: string;
  actorId?: string;
  topicId?: string;
  conversationId?: string;
  notificationId?: string;
  targetUserId?: string;
  payload?: TPayload;
  createdAt: string;
}

interface DepartmentJoinPayload {
  departmentId?: string;
  departmentCode?: string;
  userId?: string;
}

interface RoomJoinPayload {
  roomType: RealtimeRoomType;
  roomKey: string;
  userId?: string;
}

interface SocketState {
  joinedRooms?: Set<string>;
}

@WebSocketGateway({
  namespace: '/pulse',
  transports: ['websocket', 'polling'],
  cors: {
    origin: true,
    credentials: true
  }
})
export class TelemetryGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;
  
  private readonly logger = new Logger(TelemetryGateway.name);

  constructor(private configService: ConfigService) {}

  async afterInit(server: Server) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    if (redisUrl) {
      try {
        const redisOptions: any = redisUrl.startsWith('rediss://') ? { tls: { rejectUnauthorized: false } } : {};
        const pubClient = new Redis(redisUrl, redisOptions);
        const subClient = pubClient.duplicate();
        
        server.adapter(createAdapter(pubClient, subClient));
        this.logger.log('Socket.io Redis adapter initialized for distributed scaling');
      } catch (error) {
        this.logger.error('Failed to initialize Redis adapter:', error);
        this.logger.warn('Falling back to in-memory adapter (single instance only)');
      }
    } else {
      this.logger.warn('REDIS_URL not set, using in-memory adapter (single instance only)');
    }
  }

  handleConnection(client: Socket) {
    this.ensureRoomState(client);

    const handshake = client.handshake.auth as DepartmentJoinPayload | undefined;
    const departmentKey = handshake?.departmentCode ?? handshake?.departmentId;

    if (departmentKey) {
      this.joinRoom(client, 'department', departmentKey, handshake?.userId);
    }

    if (handshake?.userId) {
      this.joinRoom(client, 'user', handshake.userId, handshake.userId);
    }
  }

  handleDisconnect(client: Socket) {
    const state = client.data as SocketState;
    const joinedRooms = state.joinedRooms ?? new Set<string>();

    for (const roomName of joinedRooms) {
      const roomType = this.getRoomType(roomName);
      const roomKey = this.getRoomKey(roomName);

      client.to(roomName).emit('pulse:event', {
        roomType,
        roomKey,
        kind: 'presence',
        title: 'User disconnected',
        message: 'A client left the live room.',
        actorId: this.getActorId(client),
        createdAt: new Date().toISOString()
      } satisfies PulseEvent);
    }

    joinedRooms.clear();
  }

  @SubscribeMessage('pulse:join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() payload: DepartmentJoinPayload) {
    const departmentKey = payload.departmentCode ?? payload.departmentId;

    if (!departmentKey) {
      return { status: 'ignored', reason: 'department key is required' };
    }

    this.joinRoom(client, 'department', departmentKey, payload.userId);

    if (payload.userId) {
      this.joinRoom(client, 'user', payload.userId, payload.userId);
    }

    return { status: 'joined', departmentKey };
  }

  @SubscribeMessage('pulse:join-room')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: RoomJoinPayload) {
    this.joinRoom(client, payload.roomType, payload.roomKey, payload.userId);

    return {
      status: 'joined',
      roomType: payload.roomType,
      roomKey: payload.roomKey
    };
  }

  @SubscribeMessage('pulse:leave-room')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: RoomJoinPayload) {
    this.leaveRoom(client, payload.roomType, payload.roomKey, payload.userId);

    return {
      status: 'left',
      roomType: payload.roomType,
      roomKey: payload.roomKey
    };
  }

  emitDepartmentPulse(
    departmentKey: string,
    event: {
      topicId: string;
      type: 'upload' | 'comment' | 'lesson' | 'status';
      title?: string;
      message?: string;
      payload?: Record<string, unknown>;
    }
  ) {
    this.emitRoomEvent('department', departmentKey, {
      kind: event.type,
      title: event.title ?? this.getDefaultTitle(event.type),
      message: event.message,
      topicId: event.topicId,
      payload: event.payload
    });
  }

  emitTopicPulse(
    topicKey: string,
    event: { kind: PulseEventKind; title: string; message?: string; actorId?: string; payload?: Record<string, unknown> }
  ) {
    this.emitRoomEvent('topic', topicKey, event);
  }

  emitConversationEvent(
    conversationKey: string,
    event: { kind: PulseEventKind; title: string; message?: string; actorId?: string; payload?: Record<string, unknown> }
  ) {
    this.emitRoomEvent('conversation', conversationKey, event);
  }

  emitNotification(
    userKey: string,
    event: { title: string; message?: string; notificationId?: string; payload?: Record<string, unknown> }
  ) {
    this.emitRoomEvent('user', userKey, {
      kind: 'notification',
      title: event.title,
      message: event.message,
      notificationId: event.notificationId,
      targetUserId: userKey,
      payload: event.payload
    });
  }

  emitPresence(
    roomType: RealtimeRoomType,
    roomKey: string,
    event: { title: string; message?: string; actorId?: string; payload?: Record<string, unknown> }
  ) {
    this.emitRoomEvent(roomType, roomKey, {
      kind: 'presence',
      title: event.title,
      message: event.message,
      actorId: event.actorId,
      payload: event.payload
    });
  }

  emitRoomEvent<TPayload extends Record<string, unknown> = Record<string, unknown>>(
    roomType: RealtimeRoomType,
    roomKey: string,
    event: Omit<PulseEvent<TPayload>, 'roomType' | 'roomKey' | 'createdAt'>
  ) {
    const envelope: PulseEvent<TPayload> = {
      roomType,
      roomKey,
      createdAt: new Date().toISOString(),
      ...event
    };

    const roomName = this.getRoomName(roomType, roomKey);
    this.server.to(roomName).emit('pulse:event', envelope);

    if (roomType === 'department') {
      this.server.to(roomName).emit('pulse:update', {
        topicId: envelope.topicId,
        type: envelope.kind
      });
    }
  }

  private joinRoom(client: Socket, roomType: RealtimeRoomType, roomKey: string, userId?: string) {
    const roomName = this.getRoomName(roomType, roomKey);
    client.join(roomName);
    this.ensureRoomState(client).joinedRooms?.add(roomName);

    this.server.to(roomName).emit('pulse:event', {
      roomType,
      roomKey,
      kind: 'presence',
      title: 'User joined',
      message: 'A client joined the live room.',
      actorId: userId ?? this.getActorId(client),
      createdAt: new Date().toISOString()
    } satisfies PulseEvent);
  }

  private leaveRoom(client: Socket, roomType: RealtimeRoomType, roomKey: string, userId?: string) {
    const roomName = this.getRoomName(roomType, roomKey);
    client.leave(roomName);
    this.ensureRoomState(client).joinedRooms?.delete(roomName);

    this.server.to(roomName).emit('pulse:event', {
      roomType,
      roomKey,
      kind: 'presence',
      title: 'User left',
      message: 'A client left the live room.',
      actorId: userId ?? this.getActorId(client),
      createdAt: new Date().toISOString()
    } satisfies PulseEvent);
  }

  private ensureRoomState(client: Socket) {
    const state = client.data as SocketState;

    if (!state.joinedRooms) {
      state.joinedRooms = new Set<string>();
    }

    return state;
  }

  private getActorId(client: Socket) {
    const auth = client.handshake.auth as DepartmentJoinPayload | undefined;
    return auth?.userId;
  }

  private getRoomName(roomType: RealtimeRoomType, roomKey: string) {
    return `${roomType}:${roomKey}`;
  }

  private getRoomType(roomName: string): RealtimeRoomType {
    return (roomName.split(':')[0] as RealtimeRoomType) ?? 'department';
  }

  private getRoomKey(roomName: string) {
    return roomName.split(':').slice(1).join(':');
  }

  private getDefaultTitle(kind: PulseEventKind) {
    switch (kind) {
      case 'upload':
        return 'New material upload';
      case 'comment':
        return 'New comment';
      case 'lesson':
        return 'Lesson activity';
      case 'status':
        return 'Status update';
      default:
        return 'Live update';
    }
  }
}
