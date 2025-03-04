import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation } from '@src/chat/schema/conversation.schema';
import { Message } from '@src/chat/schema/message.schema';
import CustomLogger from '@src/common/logger';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    private readonly logger: CustomLogger,
  ) {
    this.logger.setContext('ChatService');
  }

  async createConversation(
    name: string,
    participants: string[],
    isGroup: boolean = false,
  ): Promise<Conversation> {
    // Check if a private conversation already exists between these two users
    if (!isGroup && participants.length === 2) {
      const existingConversation = await this.conversationModel
        .findOne({
          isGroup: false,
          participants: { $all: participants, $size: 2 },
        })
        .exec();

      if (existingConversation) {
        return existingConversation;
      }
    }

    // Create a new conversation
    const newConversation = new this.conversationModel({
      name: name || null,
      participants,
      isGroup,
    });

    this.logger.logWithContext(
      'info',
      `Creating conversation with participants: ${participants}`,
    );
    return newConversation.save();
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    return this.conversationModel
      .find({ participants: userId })
      .populate('participants', 'name email')
      .populate('lastMessage')
      .exec();
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationModel
      .findById(conversationId)
      .populate('participants', 'name email')
      .populate('lastMessage')
      .exec();

    if (!conversation) {
      throw new NotFoundException(`Conversation not found`);
    }

    return conversation;
  }

  async createMessage(
    senderId: string,
    conversationId: string,
    content: string,
  ): Promise<Message> {
    // Check if user is part of the conversation
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const participantIds = conversation.participants.map((p) =>
      p.toString ? p.toString() : p,
    );

    if (!participantIds.includes(senderId)) {
      throw new ForbiddenException('User is not part of this conversation');
    }

    // Create and save the message
    const newMessage = new this.messageModel({
      sender: senderId,
      content,
      conversation: conversationId,
    });

    const savedMessage = await newMessage.save();

    // Update the conversation's last message
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: savedMessage._id,
    });

    return savedMessage.populate('sender', 'name email');
  }

  async getConversationMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    messages: Message[];
    total: number;
    page: number;
    pages: number;
  }> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const total = await this.messageModel.countDocuments({
      conversation: conversationId,
    });
    const pages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const messages = await this.messageModel
      .find({ conversation: conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'name email')
      .exec();

    return {
      messages: messages.reverse(), // Return in chronological order
      total,
      page,
      pages,
    };
  }

  async markConversationAsRead(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    // Check if user is part of the conversation
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const participantIds = conversation.participants.map((p) =>
      p.toString ? p.toString() : p,
    );

    if (!participantIds.includes(userId)) {
      throw new ForbiddenException('User is not part of this conversation');
    }

    // Mark all messages in the conversation as read
    await this.messageModel.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId }, // Only mark messages from other users
        isRead: false,
      },
      { isRead: true },
    );
  }

  async addParticipantToConversation(
    conversationId: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check if user is already a participant
    const participantIds = conversation.participants.map((p) =>
      p.toString ? p.toString() : p,
    );

    if (participantIds.includes(userId)) {
      return conversation; // User is already a participant
    }

    // Add user to participants
    conversation.participants.push(userId as any);
    return conversation.save();
  }

  async removeParticipantFromConversation(
    conversationId: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Create a new participant list without the removed user
    const updatedParticipants = conversation.participants.filter(
      (p) => p.toString() !== userId,
    ) as typeof conversation.participants;

    // Update and save
    conversation.participants = updatedParticipants;
    return conversation.save();
  }
}
