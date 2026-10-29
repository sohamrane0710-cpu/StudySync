import {
  Logger,
  UseFilters,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/collaboration',
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization as string);

      if (!authHeader) {
        this.logger.debug(`Socket client ${client.id} missing auth token. Disconnecting.`);
        client.disconnect(true);
        return;
      }

      const token = authHeader.replace(/^Bearer\s+/i, '');
      const user = await this.authService.verifyToken(token);

      client.data.user = user;
      this.logger.debug(`Socket client connected: ${client.id} (User: ${user.id})`);
    } catch (err: any) {
      this.logger.debug(`Socket auth failed for ${client.id}: ${err.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const user = client.data.user;
    if (!user || !data?.roomId) return;

    // Verify room membership
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: data.roomId, userId: user.id } },
    });

    if (!membership) {
      client.emit('error', { message: 'You are not a member of this room' });
      return;
    }

    client.join(`room:${data.roomId}`);
    this.logger.debug(`User ${user.id} joined socket room: room:${data.roomId}`);
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (data?.roomId) {
      client.leave(`room:${data.roomId}`);
    }
  }

  broadcastToRoom(roomId: string, event: string, payload: any) {
    if (this.server) {
      this.server.to(`room:${roomId}`).emit(event, payload);
    }
  }
}
