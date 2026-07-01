import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, type ConversationType } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import { CacheService } from '../core/services/cache.service';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';

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

function uniqueIds(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly telemetryGateway: TelemetryGateway
  ) {}

  async createConversation(userId: string, body: CreateConversationBody) {
    const memberIds = uniqueIds([userId, ...(body.memberIds ?? [])]);
    const type: ConversationType = body.type ?? 'GROUP';

    if (type === 'DIRECT' && memberIds.length !== 2) {
      throw new BadRequestException('Direct conversations require exactly two members');
    }

    if (memberIds.length < 2) {
      throw new BadRequestException('A conversation requires at least two members');
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        type,
        title: body.title?.trim() || null,
        departmentId: body.departmentId?.trim() || null,
        topicId: body.topicId?.trim() || null,
        createdById: userId,
        members: {
          create: memberIds.map((memberId) => ({
            userId: memberId,
            role: memberId === userId ? 'OWNER' : 'MEMBER'
          }))
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                departmentId: true
              }
            }
          }
        }
      }
    });

    this.telemetryGateway.emitConversationEvent(conversation.id, {
      kind: 'status',
      title: conversation.title ?? 'Conversation created',
      message: 'A new conversation is ready for live messages.',
      actorId: userId,
      payload: {
        conversationId: conversation.id,
        type: conversation.type,
        memberCount: conversation.members.length
      }
    });

    // Invalidate conversation cache for all members
    for (const memberId of memberIds) {
      this.cacheService.invalidate(`conversations:user:${memberId}`).catch((err) => {
        this.logger.error(`Failed to invalidate conversation cache: ${err}`);
      });
    }

    return conversation;
  }

  async listConversations(userId: string) {
    const cacheKey = `conversations:user:${userId}`;
    
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const memberships = await this.prisma.conversationMember.findMany({
          where: { userId },
          select: {
            role: true,
            lastReadAt: true,
            joinedAt: true,
            conversation: {
              select: {
                id: true,
                type: true,
                title: true,
                createdAt: true,
                updatedAt: true,
                members: {
                  select: {
                    role: true,
                    user: {
                      select: {
                        id: true,
                        fullName: true,
                        avatarUrl: true,
                        departmentId: true
                      }
                    }
                  }
                },
                messages: {
                  take: 1,
                  orderBy: { createdAt: 'desc' as const },
                  select: {
                    id: true,
                    content: true,
                    createdAt: true,
                    sender: {
                      select: {
                        id: true,
                        fullName: true,
                        avatarUrl: true
                      }
                    }
                  }
                }
              }
            }
          },
          orderBy: { joinedAt: 'desc' }
        });

        const enriched = await Promise.all(
          memberships.map(async (membership) => {
            const lastReadAt = membership.lastReadAt;
            const unreadCount = await this.prisma.message.count({
              where: {
                conversationId: membership.conversation.id,
                deletedAt: null,
                senderId: { not: userId },
                createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
              },
            });

            return {
              ...membership.conversation,
              membership: {
                role: membership.role,
                lastReadAt: membership.lastReadAt,
                joinedAt: membership.joinedAt,
                unreadCount,
              },
            };
          })
        );

        return enriched;
      },
      60 // Cache for 1 minute (conversations change frequently)
    );
  }

  async listMessages(userId: string, conversationId: string, take = 50) {
    await this.requireMembership(userId, conversationId);

    const size = Number.isFinite(take) ? Math.min(Math.max(Math.trunc(take), 1), 100) : 50;

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: size,
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            departmentId: true
          }
        },
        receipts: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });
  }

  async sendMessage(userId: string, conversationId: string, body: SendMessageBody) {
    const content = body.content?.trim();

    if (!content) {
      throw new BadRequestException('Message content is required');
    }

    const membership = await this.requireMembership(userId, conversationId);
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        metadata: body.metadata as Prisma.InputJsonValue | undefined
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            departmentId: true
          }
        }
      }
    });

    const notificationTargets = conversation.members
      .map((member) => member.userId)
      .filter((memberId) => memberId !== userId);

    await this.prisma.$transaction(async (prisma) => {
      for (const targetUserId of notificationTargets) {
        await prisma.notification.create({
          data: {
            userId: targetUserId,
            kind: 'MESSAGE',
            title: conversation.title ?? 'New message',
            message: content,
            payload: {
              conversationId,
              messageId: message.id,
              senderId: userId,
              senderName: message.sender.fullName,
              conversationType: conversation.type
            },
            sourceMessageId: message.id
          }
        });
      }
    });

    for (const targetUserId of notificationTargets) {
      this.telemetryGateway.emitNotification(targetUserId, {
        title: conversation.title ?? 'New message',
        message: content,
        notificationId: message.id,
        payload: {
          conversationId,
          messageId: message.id,
          senderId: userId,
          conversationType: conversation.type
        }
      });
    }

    this.telemetryGateway.emitConversationEvent(conversationId, {
      kind: 'message',
      title: conversation.title ?? 'New message',
      message: content,
      actorId: userId,
      payload: {
        conversationId,
        messageId: message.id,
        senderId: userId,
        senderName: message.sender.fullName,
        memberCount: conversation.members.length,
        unreadCount: await this.getUnreadCountForConversation(userId, conversationId, membership.lastReadAt ?? null),
        fullMessage: message,
      }
    });

    if (conversation.departmentId) {
      this.telemetryGateway.emitRoomEvent('department', conversation.departmentId, {
        kind: 'message',
        title: conversation.title ?? 'Department message',
        message: content,
        actorId: userId,
        payload: {
          conversationId,
          messageId: message.id,
          senderId: userId,
          senderName: message.sender.fullName
        }
      });
    }

    if (conversation.topicId) {
      this.telemetryGateway.emitTopicPulse(conversation.topicId, {
        kind: 'message',
        title: conversation.title ?? 'Topic message',
        message: content,
        actorId: userId,
        payload: {
          conversationId,
          messageId: message.id,
          senderId: userId,
          senderName: message.sender.fullName
        }
      });
    }

    // Invalidate conversation cache for all members
    for (const member of conversation.members) {
      this.cacheService.invalidate(`conversations:user:${member.userId}`).catch((err) => {
        this.logger.error(`Failed to invalidate conversation cache: ${err}`);
      });
    }

    return message;
  }

  async editMessage(userId: string, messageId: string, content: string) {
    const nextContent = content.trim();

    if (!nextContent) {
      throw new BadRequestException('Message content is required');
    }

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { members: true } } }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.requireMembership(userId, message.conversationId);

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: nextContent,
        editedAt: new Date()
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            departmentId: true
          }
        }
      }
    });

    this.telemetryGateway.emitConversationEvent(message.conversationId, {
      kind: 'edit',
      title: 'Message edited',
      message: nextContent,
      actorId: userId,
      payload: {
        conversationId: message.conversationId,
        messageId,
        senderId: userId,
        fullMessage: updated,
      }
    });

    return updated;
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true }
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.requireMembership(userId, message.conversationId);

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: '[deleted]',
        deletedAt: new Date(),
        editedAt: new Date()
      }
    });

    this.telemetryGateway.emitConversationEvent(message.conversationId, {
      kind: 'delete',
      title: 'Message deleted',
      message: 'A message was removed.',
      actorId: userId,
      payload: {
        conversationId: message.conversationId,
        messageId,
        senderId: userId
      }
    });

    return updated;
  }

  async markConversationRead(userId: string, conversationId: string, messageId?: string) {
    const membership = await this.requireMembership(userId, conversationId);
    const messageWhere = messageId
      ? { id: messageId, conversationId }
      : { conversationId, deletedAt: null };

    const targetMessage = messageId
      ? await this.prisma.message.findUnique({ where: { id: messageId } })
      : await this.prisma.message.findFirst({ where: { conversationId }, orderBy: { createdAt: 'desc' } });

    if (!targetMessage) {
      throw new NotFoundException('Message not found');
    }

    const unreadMessages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        senderId: { not: userId },
        createdAt: {
          gt: membership.lastReadAt ?? new Date(0),
          lte: targetMessage.createdAt
        }
      },
      select: { id: true, createdAt: true, senderId: true }
    });

    await this.prisma.$transaction(async (prisma) => {
      for (const unreadMessage of unreadMessages) {
        await prisma.messageReadReceipt.upsert({
          where: {
            messageId_userId: {
              messageId: unreadMessage.id,
              userId
            }
          },
          update: {
            readAt: new Date()
          },
          create: {
            messageId: unreadMessage.id,
            userId,
            readAt: new Date()
          }
        });
      }

      await prisma.conversationMember.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId
          }
        },
        data: {
          lastReadAt: targetMessage.createdAt
        }
      });
    });

    this.telemetryGateway.emitConversationEvent(conversationId, {
      kind: 'read',
      title: 'Read receipt',
      message: 'Conversation marked as read.',
      actorId: userId,
      payload: {
        conversationId,
        messageId: targetMessage.id,
        readCount: unreadMessages.length
      }
    });

    return {
      conversationId,
      messageId: targetMessage.id,
      readCount: unreadMessages.length
    };
  }

  async sendTyping(userId: string, conversationId: string, isTyping: boolean) {
    await this.requireMembership(userId, conversationId);

    this.telemetryGateway.emitConversationEvent(conversationId, {
      kind: 'typing',
      title: isTyping ? 'Typing' : 'Typing stopped',
      message: isTyping ? 'Someone is typing...' : 'Typing stopped.',
      actorId: userId,
      payload: {
        conversationId,
        isTyping,
        userId
      }
    });

    return { conversationId, isTyping };
  }

  async getUnreadSummary(userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: {
        conversationId: true,
        lastReadAt: true
      }
    });

    const conversations = await Promise.all(
      memberships.map(async (membership) => ({
        conversationId: membership.conversationId,
        unreadCount: await this.getUnreadCountForConversation(userId, membership.conversationId, membership.lastReadAt)
      }))
    );

    const unreadNotifications = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null
      }
    });

    return {
      totalUnreadMessages: conversations.reduce((sum, entry) => sum + entry.unreadCount, 0),
      unreadNotifications,
      conversations
    };
  }

  async searchUsers(userId: string, query: string) {
    if (!query.trim()) return [];

    return this.prisma.user.findMany({
      where: {
        id: { not: userId },
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { matricNumber: { contains: query, mode: 'insensitive' } },
          { schoolEmail: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        department: { select: { code: true, name: true } },
        currentLevel: true,
        matricNumber: true,
      },
      take: 20,
      orderBy: { fullName: 'asc' },
    });
  }

  async searchClassmates(userId: string) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, currentLevel: true },
    });

    if (!currentUser?.departmentId || !currentUser?.currentLevel) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        id: { not: userId },
        departmentId: currentUser.departmentId,
        currentLevel: currentUser.currentLevel,
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        department: { select: { code: true, name: true } },
        currentLevel: true,
        matricNumber: true,
      },
      take: 50,
      orderBy: { fullName: 'asc' },
    });
  }

  async listNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        sourceMessage: {
          select: {
            id: true,
            conversationId: true,
            senderId: true,
            content: true,
            createdAt: true
          }
        }
      }
    });
  }

  async markNotificationRead(userId: string, notificationId: string, readAt?: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId }
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        readAt: readAt ? new Date(readAt) : new Date()
      }
    });

    this.telemetryGateway.emitNotification(userId, {
      title: 'Notification read',
      message: notification.title,
      notificationId,
      payload: {
        notificationId,
        readAt: updated.readAt?.toISOString() ?? new Date().toISOString()
      }
    });

    return updated;
  }

  private async requireMembership(userId: string, conversationId: string) {
    const membership = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId
        }
      }
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    return membership;
  }

  private async getUnreadCountForConversation(userId: string, conversationId: string, lastReadAt: Date | null) {
    return this.prisma.message.count({
      where: {
        conversationId,
        deletedAt: null,
        senderId: { not: userId },
        createdAt: {
          gt: lastReadAt ?? new Date(0)
        }
      }
    });
  }
}