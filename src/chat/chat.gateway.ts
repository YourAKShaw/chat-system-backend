import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from '@src/chat/chat.service';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '@src/auth/ws-jwt.guard';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      if (!userId) {
        client.disconnect();
        return;
      }

      // Store connection
      this.connectedUsers.set(userId, client.id);
      client.data.userId = userId;

      // Join rooms for all conversations this user is in
      const conversations = await this.chatService.getUserConversations(userId);
      conversations.forEach((conversation) => {
        client.join(`conversation-${conversation._id}`);
      });
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.connectedUsers.delete(userId);
    }
  }

  @SubscribeMessage('joinConversation')
  joinConversation(client: Socket, conversationId: string) {
    client.join(`conversation-${conversationId}`);
    return { event: 'joinedConversation', data: { conversationId } };
  }

  @SubscribeMessage('leaveConversation')
  leaveConversation(client: Socket, conversationId: string) {
    client.leave(`conversation-${conversationId}`);
    return { event: 'leftConversation', data: { conversationId } };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendMessage')
  async handleMessage(
    client: Socket,
    payload: { conversationId: string; content: string },
  ) {
    const userId = client.data.userId;

    if (!userId || !payload.conversationId || !payload.content) {
      throw new WsException('Invalid data');
    }

    const message = await this.chatService.createMessage(
      userId,
      payload.conversationId,
      payload.content,
    );

    // Emit to all clients in the conversation room
    this.server
      .to(`conversation-${payload.conversationId}`)
      .emit('newMessage', message);

    return { event: 'messageSent', data: message };
  }

  @SubscribeMessage('typing')
  async typing(
    client: Socket,
    payload: { conversationId: string; isTyping: boolean },
  ) {
    const userId = client.data.userId;

    if (!userId || !payload.conversationId) {
      throw new WsException('Invalid data');
    }

    // Emit typing status to all clients in the conversation except sender
    client
      .to(`conversation-${payload.conversationId}`)
      .emit('userTyping', { userId, isTyping: payload.isTyping });
  }

  @SubscribeMessage('readMessages')
  async readMessages(client: Socket, conversationId: string) {
    const userId = client.data.userId;

    if (!userId || !conversationId) {
      throw new WsException('Invalid data');
    }

    await this.chatService.markConversationAsRead(userId, conversationId);

    // Notify other users that messages have been read
    client
      .to(`conversation-${conversationId}`)
      .emit('messagesRead', { userId, conversationId });
  }

  // Helper method to notify users about new messages
  notifyNewMessage(message: any) {
    this.server
      .to(`conversation-${message.conversation}`)
      .emit('newMessage', message);
  }
}
