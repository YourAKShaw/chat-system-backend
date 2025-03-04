// src/chat/chat.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { Message, MessageSchema } from './schema/message.schema';
import { Conversation, ConversationSchema } from './schema/conversation.schema';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import CustomLogger from '@src/common/logger';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatGateway,
    WsJwtGuard,
    {
      provide: CustomLogger,
      useFactory: () => {
        return new CustomLogger('ChatModule');
      },
    },
  ],
  exports: [ChatService],
})
export class ChatModule {}
