import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import { ApiResponse } from '@src/common/response/api-response';
import { TransformInterceptor } from '@src/common/interceptors/transform.interceptor';

@Controller('chat')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TransformInterceptor)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  async createConversation(
    @Request() req: any,
    @Body('name') name: string,
    @Body('participants') participants: string[],
    @Body('isGroup') isGroup: boolean,
  ) {
    // Ensure the current user is included in participants
    if (!participants.includes(req.user.userId)) {
      participants.push(req.user.userId);
    }

    const conversation = await this.chatService.createConversation(
      name,
      participants,
      isGroup,
    );

    return ApiResponse.success(
      conversation,
      'Conversation created successfully',
      201,
    );
  }

  @Get('conversations')
  async getUserConversations(@Request() req: any) {
    const conversations = await this.chatService.getUserConversations(
      req.user.userId,
    );
    return ApiResponse.success(
      conversations,
      'Conversations retrieved successfully',
    );
  }

  @Get('conversations/:id')
  async getConversation(@Param('id') id: string) {
    const conversation = await this.chatService.getConversation(id);
    return ApiResponse.success(
      conversation,
      'Conversation retrieved successfully',
    );
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Request() req: any,
    @Param('id') conversationId: string,
    @Body('content') content: string,
  ) {
    const message = await this.chatService.createMessage(
      req.user.userId,
      conversationId,
      content,
    );

    return ApiResponse.success(message, 'Message sent successfully', 201);
  }

  @Get('conversations/:id/messages')
  async getConversationMessages(
    @Param('id') conversationId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const result = await this.chatService.getConversationMessages(
      conversationId,
      page,
      limit,
    );

    return ApiResponse.success(
      result.messages,
      'Messages retrieved successfully',
      200,
      { total: result.total, page: result.page, pages: result.pages },
    );
  }

  @Post('conversations/:id/read')
  async markConversationAsRead(
    @Request() req: any,
    @Param('id') conversationId: string,
  ) {
    await this.chatService.markConversationAsRead(
      req.user.userId,
      conversationId,
    );
    return ApiResponse.success(null, 'Messages marked as read');
  }

  @Post('conversations/:id/participants')
  async addParticipant(
    @Param('id') conversationId: string,
    @Body('userId') userId: string,
  ) {
    const conversation = await this.chatService.addParticipantToConversation(
      conversationId,
      userId,
    );
    return ApiResponse.success(
      conversation,
      'Participant added to conversation successfully',
    );
  }

  @Post('conversations/:id/participants/remove')
  async removeParticipant(
    @Param('id') conversationId: string,
    @Body('userId') userId: string,
  ) {
    const conversation =
      await this.chatService.removeParticipantFromConversation(
        conversationId,
        userId,
      );
    return ApiResponse.success(
      conversation,
      'Participant removed from conversation successfully',
    );
  }
}
