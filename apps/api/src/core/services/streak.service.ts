import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from './cache.service';

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService
  ) {}

  /**
   * Check in user for daily activity - maintains or breaks streak
   */
  async checkInDaily(userId: string): Promise<{ currentStreak: number; longestStreak: number; pointsEarned: number }> {
    let streak = await this.prisma.userStreak.findUnique({
      where: { userId }
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Create streak record if doesn't exist
    if (!streak) {
      streak = await this.prisma.userStreak.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastActivityAt: now,
          streakStartedAt: today
        }
      });

      // Award daily login points
      await this.awardPoints(userId, 10, 'daily_login', 'Logged in to Vylix');

      return { currentStreak: 1, longestStreak: 1, pointsEarned: 10 };
    }

    const lastActivity = new Date(streak.lastActivityAt.getFullYear(), streak.lastActivityAt.getMonth(), streak.lastActivityAt.getDate());

    // Check if already checked in today
    if (lastActivity.getTime() === today.getTime()) {
      return { currentStreak: streak.currentStreak, longestStreak: streak.longestStreak, pointsEarned: 0 };
    }

    // Check if streak continues (checked in yesterday)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const streakContinues = lastActivity.getTime() === yesterday.getTime();

    let newCurrentStreak = streakContinues ? streak.currentStreak + 1 : 1;

    // Update longest streak
    const newLongestStreak = Math.max(newCurrentStreak, streak.longestStreak);

    // Update streak
    await this.prisma.userStreak.update({
      where: { userId },
      data: {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastActivityAt: now,
        ...(newCurrentStreak === 1 && { streakStartedAt: today }) // Reset start date if streak broken
      }
    });

    // Award points: base 10 + bonus for consecutive days
    const pointsEarned = 10 + Math.floor(newCurrentStreak / 5) * 5; // Bonus: +5 every 5 days
    await this.awardPoints(userId, pointsEarned, 'daily_login', `Logged in - ${newCurrentStreak} day streak!`);

    // Invalidate cache
    await this.cacheService.invalidate(`user:streak:${userId}`);

    this.logger.log(`User ${userId} checked in: streak=${newCurrentStreak}, points=${pointsEarned}`);

    return { currentStreak: newCurrentStreak, longestStreak: newLongestStreak, pointsEarned };
  }

  /**
   * Get user's streak data with caching
   */
  async getStreakData(userId: string) {
    const cacheKey = `user:streak:${userId}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        return this.prisma.userStreak.findUnique({
          where: { userId },
          select: {
            currentStreak: true,
            longestStreak: true,
            lastActivityAt: true,
            streakStartedAt: true
          }
        });
      },
      3600 // Cache for 1 hour
    );
  }

  /**
   * Award points to user
   */
  async awardPoints(userId: string, amount: number, reason: string, description?: string) {
    try {
      await this.prisma.pointsTransaction.create({
        data: {
          userId,
          amount,
          reason,
          description
        }
      });

      // Invalidate user points cache
      await this.cacheService.invalidate(`user:points:${userId}`);
    } catch (error) {
      this.logger.error(`Failed to award points to ${userId}: ${error}`);
      throw error;
    }
  }

  /**
   * Get user's total points
   */
  async getUserTotalPoints(userId: string): Promise<number> {
    const cacheKey = `user:points:${userId}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const result = await this.prisma.pointsTransaction.aggregate({
          where: { userId },
          _sum: {
            amount: true
          }
        });

        return result._sum.amount ?? 0;
      },
      1800 // Cache for 30 minutes
    );
  }

  /**
   * Get user's points history
   */
  async getPointsHistory(userId: string, limit = 50) {
    return this.prisma.pointsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        amount: true,
        reason: true,
        description: true,
        createdAt: true
      }
    });
  }

  /**
   * Top users by current streak (for leaderboard)
   */
  async getTopStreakUsers(limit = 10) {
    return this.prisma.userStreak.findMany({
      orderBy: { currentStreak: 'desc' },
      take: limit,
      select: {
        userId: true,
        currentStreak: true,
        longestStreak: true
      }
    });
  }

  /**
   * Top users by total points (for leaderboard)
   */
  async getTopPointsUsers(limit = 10) {
    const users = await this.prisma.pointsTransaction.groupBy({
      by: ['userId'],
      _sum: {
        amount: true
      },
      orderBy: {
        _sum: {
          amount: 'desc'
        }
      },
      take: limit
    });

    return users.map(user => ({
      userId: user.userId,
      totalPoints: user._sum.amount ?? 0
    }));
  }
}
