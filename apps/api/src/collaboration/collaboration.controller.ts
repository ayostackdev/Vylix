import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { CollaborationService } from './collaboration.service';

interface RequestUser {
  id?: string;
}

interface CreateConversationBody {
  type?: 'DIRECT' | 'GROUP';
  title?: string;
  memberIds?: string[];
  departmentId?: string;
  topicId?: string;
}

interface SendMessageBody {
  content?: string;
  metadata?: Record<string, unknown>;
}

interface ReadConversationBody {
  messageId?: string;
}

interface TypingBody {
  isTyping?: boolean;
}

interface NotificationReadBody {
  readAt?: string;
}

@Controller('collaboration')
@UseGuards(SupabaseAuthGuard)
export class CollaborationController {
  private readonly logger = new Logger(CollaborationController.name);

  constructor(private readonly collaborationService: CollaborationService) {}

  private requireUserId(req: Request): string {
    const userId = (req as Request & { user?: RequestUser }).user?.id;

    if (!userId) {
      throw new Error('Authentication required');
    }

    return userId;
  }

  @Post('conversations')
  async createConversation(@Req() req: Request, @Body() body: CreateConversationBody) {
    const userId = this.requireUserId(req);
    this.logger.log(`Creating conversation for ${userId}`);
    return this.collaborationService.createConversation(userId, body);
  }

  @Get('conversations')
  async listConversations(@Req() req: Request) {
    const userId = this.requireUserId(req);
    return this.collaborationService.listConversations(userId);
  }

  @Get('conversations/:conversationId/messages')
  async listMessages(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Query('take') take?: string
  ) {
    const userId = this.requireUserId(req);
    return this.collaborationService.listMessages(userId, conversationId, take ? Number(take) : 50);
  }

  @Post('conversations/:conversationId/messages')
  async sendMessage(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Body() body: SendMessageBody
  ) {
    const userId = this.requireUserId(req);
    return this.collaborationService.sendMessage(userId, conversationId, body);
  }

  @Patch('messages/:messageId')
  async editMessage(
    @Req() req: Request,
    @Param('messageId') messageId: string,
    @Body('content') content?: string
  ) {
    const userId = this.requireUserId(req);
    return this.collaborationService.editMessage(userId, messageId, content ?? '');
  }

  @Delete('messages/:messageId')
  async deleteMessage(@Req() req: Request, @Param('messageId') messageId: string) {
    const userId = this.requireUserId(req);
    return this.collaborationService.deleteMessage(userId, messageId);
  }

  @Post('conversations/:conversationId/read')
  async markConversationRead(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Body() body: ReadConversationBody
  ) {
    const userId = this.requireUserId(req);
    return this.collaborationService.markConversationRead(userId, conversationId, body.messageId);
  }

  @Post('conversations/:conversationId/typing')
  async typing(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Body() body: TypingBody
  ) {
    const userId = this.requireUserId(req);
    return this.collaborationService.sendTyping(userId, conversationId, body.isTyping ?? true);
  }

  @Get('unread-summary')
  async getUnreadSummary(@Req() req: Request) {
    const userId = this.requireUserId(req);
    return this.collaborationService.getUnreadSummary(userId);
  }

  @Get('users/search')
  async searchUsers(@Req() req: Request, @Query('q') q?: string) {
    const userId = this.requireUserId(req);
    return this.collaborationService.searchUsers(userId, q ?? '');
  }

  @Get('notifications')
  async listNotifications(@Req() req: Request) {
    const userId = this.requireUserId(req);
    return this.collaborationService.listNotifications(userId);
  }

  @Post('notifications/:notificationId/read')
  async markNotificationRead(
    @Req() req: Request,
    @Param('notificationId') notificationId: string,
    @Body() body: NotificationReadBody
  ) {
    const userId = this.requireUserId(req);
    return this.collaborationService.markNotificationRead(userId, notificationId, body.readAt);
  }
}