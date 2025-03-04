import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '@src/users/schema/user.schema';
import { Conversation } from '@src/chat/schema/conversation.schema';

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'User' })
  sender!: User | MongooseSchema.Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'User' })
  receiver!: User | MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Conversation' })
  conversation!: Conversation | MongooseSchema.Types.ObjectId;

  @Prop({ default: false })
  isRead!: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
