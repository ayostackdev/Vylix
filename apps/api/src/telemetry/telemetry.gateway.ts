import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/pulse',
  cors: {
    origin: true,
    credentials: true
  }
})
export class TelemetryGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    const departmentId = client.handshake.auth.departmentId as string | undefined;
    if (departmentId) {
      client.join(this.getDepartmentRoom(departmentId));
    }
  }

  @SubscribeMessage('pulse:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { departmentId: string }
  ) {
    client.join(this.getDepartmentRoom(payload.departmentId));
    return { status: 'joined', departmentId: payload.departmentId };
  }

  emitDepartmentPulse(departmentId: string, event: { topicId: string; type: 'upload' | 'comment' | 'lesson' }) {
    this.server.to(this.getDepartmentRoom(departmentId)).emit('pulse:update', event);
  }

  private getDepartmentRoom(departmentId: string) {
    return `department:${departmentId}`;
  }
}
