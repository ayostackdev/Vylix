import { BadRequestException, Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from './cache.service';
import { StreakService } from './streak.service';

interface CreateQuestionDto {
  title: string;
  content: string;
}

interface CreateAnswerDto {
  content: string;
}

@Injectable()
export class QnaService {
  private readonly logger = new Logger(QnaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly streakService: StreakService
  ) {}

  /**
   * Create a new question in a topic
   */
  async createQuestion(topicId: string, authorId: string, dto: CreateQuestionDto) {
    // Verify topic exists
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId }
    });

    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const question = await this.prisma.topicQuestion.create({
      data: {
        topicId,
        authorId,
        title: dto.title.trim(),
        content: dto.content.trim()
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            contributionScore: true
          }
        }
      }
    });

    // Award points for asking question
    await this.streakService.awardPoints(authorId, 5, 'ask_question', `Asked: "${dto.title.substring(0, 50)}"`);

    // Invalidate topic cache
    await this.cacheService.invalidate(`topic:questions:${topicId}`);

    this.logger.log(`Question created: ${question.id} in topic ${topicId} by ${authorId}`);

    return question;
  }

  /**
   * Get questions in a topic with caching
   */
  async getTopicQuestions(topicId: string, limit = 20, offset = 0) {
    const cacheKey = `topic:questions:${topicId}:${limit}:${offset}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        return this.prisma.topicQuestion.findMany({
          where: { topicId },
          orderBy: [{ isResolved: 'asc' }, { helpCount: 'desc' }, { createdAt: 'desc' }],
          take: limit,
          skip: offset,
          select: {
            id: true,
            title: true,
            content: true,
            helpCount: true,
            viewCount: true,
            isResolved: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                contributionScore: true
              }
            },
            answers: {
              select: {
                id: true,
                content: true,
                helpCount: true,
                isAccepted: true,
                createdAt: true,
                author: {
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
      },
      600 // Cache for 10 minutes
    );
  }

  /**
   * Answer a question
   */
  async answerQuestion(questionId: string, authorId: string, dto: CreateAnswerDto) {
    // Verify question exists
    const question = await this.prisma.topicQuestion.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const answer = await this.prisma.questionAnswer.create({
      data: {
        questionId,
        authorId,
        content: dto.content.trim()
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true
          }
        }
      }
    });

    // Award points for answering
    await this.streakService.awardPoints(authorId, 10, 'answer_question', 'Answered a question');

    // Invalidate question cache
    await this.cacheService.invalidate(`topic:questions:${question.topicId}`);

    this.logger.log(`Answer created: ${answer.id} for question ${questionId}`);

    return answer;
  }

  /**
   * Mark answer as helpful
   */
  async markAnswerHelpful(answerId: string, userId: string) {
    const answer = await this.prisma.questionAnswer.findUnique({
      where: { id: answerId },
      include: {
        question: true
      }
    });

    if (!answer) {
      throw new NotFoundException('Answer not found');
    }

    // Increment helpCount
    const updated = await this.prisma.questionAnswer.update({
      where: { id: answerId },
      data: {
        helpCount: {
          increment: 1
        }
      }
    });

    // Award points to answer author (2 points per helpful mark, max 50 per answer)
    if (updated.helpCount <= 50) {
      await this.streakService.awardPoints(
        answer.authorId,
        2,
        'answer_marked_helpful',
        'Your answer was marked as helpful'
      );
    }

    // Invalidate cache
    await this.cacheService.invalidate(`topic:questions:${answer.question.topicId}`);

    return updated;
  }

  /**
   * Mark answer as best/accepted answer
   */
  async markAnswerAccepted(answerId: string, questionId: string, userId: string) {
    // Verify user is question author
    const question = await this.prisma.topicQuestion.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    if (question.authorId !== userId) {
      throw new ForbiddenException('Only question author can mark accepted answer');
    }

    // Check if answer exists
    const answer = await this.prisma.questionAnswer.findUnique({
      where: { id: answerId }
    });

    if (!answer || answer.questionId !== questionId) {
      throw new NotFoundException('Answer not found in this question');
    }

    // Clear previous accepted answer
    await this.prisma.questionAnswer.updateMany({
      where: { questionId, isAccepted: true },
      data: { isAccepted: false }
    });

    // Mark new accepted answer
    const updated = await this.prisma.questionAnswer.update({
      where: { id: answerId },
      data: { isAccepted: true }
    });

    // Mark question as resolved
    await this.prisma.topicQuestion.update({
      where: { id: questionId },
      data: { isResolved: true }
    });

    // Award bonus points for accepted answer
    await this.streakService.awardPoints(
      answer.authorId,
      25,
      'answer_accepted',
      'Your answer was marked as the best solution!'
    );

    // Invalidate cache
    await this.cacheService.invalidate(`topic:questions:${question.topicId}`);

    return updated;
  }

  /**
   * Get trending questions for recommendations
   */
  async getTrendingQuestions(limit = 5) {
    // Questions with most answers or help votes in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.prisma.topicQuestion.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        }
      },
      orderBy: [{ isResolved: 'asc' }, { helpCount: 'desc' }, { viewCount: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        helpCount: true,
        viewCount: true,
        isResolved: true,
        topicId: true,
        author: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true
          }
        }
      }
    });
  }

  /**
   * Search questions by content
   */
  async searchQuestions(query: string, topicId?: string, limit = 20) {
    return this.prisma.topicQuestion.findMany({
      where: {
        ...(topicId && { topicId }),
        OR: [{ title: { contains: query, mode: 'insensitive' } }, { content: { contains: query, mode: 'insensitive' } }]
      },
      orderBy: [{ isResolved: 'asc' }, { helpCount: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        helpCount: true,
        isResolved: true,
        topicId: true,
        author: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true
          }
        }
      }
    });
  }

  /**
   * Get top answerers in a topic
   */
  async getTopAnswerersInTopic(topicId: string, limit = 10) {
    const answerers = await this.prisma.questionAnswer.groupBy({
      by: ['authorId'],
      where: {
        question: {
          topicId
        }
      },
      _count: true,
      _sum: {
        helpCount: true
      },
      orderBy: [
        {
          _sum: {
            helpCount: 'desc'
          }
        },
        {
          _count: {
            id: 'desc'
          }
        }
      ],
      take: limit
    });

    return answerers.map(a => ({
      userId: a.authorId,
      answerCount: a._count,
      helpfulCount: a._sum?.helpCount ?? 0
    }));
  }

  /**
   * Increment view count for question
   */
  async incrementViewCount(questionId: string) {
    try {
      await this.prisma.topicQuestion.update({
        where: { id: questionId },
        data: {
          viewCount: {
            increment: 1
          }
        }
      });
    } catch (error) {
      this.logger.error(`Failed to increment view count: ${error}`);
    }
  }
}
