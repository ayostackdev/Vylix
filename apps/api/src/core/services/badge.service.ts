import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BadgeRarity } from '@prisma/client';

export interface CreateBadgeDto {
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity?: BadgeRarity;
  criteria: string;
}

export interface AwardBadgeDto {
  userId: string;
  badgeCode: string;
  awardedBy?: string;
}

@Injectable()
export class BadgeService {
  private readonly logger = new Logger(BadgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new badge template
   */
  async createBadge(data: CreateBadgeDto) {
    try {
      // Check if badge already exists
      const existing = await this.prisma.badge.findUnique({
        where: { code: data.code },
      });

      if (existing) {
        throw new ConflictException(`Badge with code "${data.code}" already exists`);
      }

      const badge = await this.prisma.badge.create({
        data: {
          code: data.code,
          name: data.name,
          description: data.description,
          icon: data.icon,
          rarity: data.rarity || 'COMMON',
          criteria: data.criteria,
        },
      });

      this.logger.log(`Badge created: ${data.code}`);
      return badge;
    } catch (error) {
      this.logger.error(`Error creating badge: ${data.code}`, error);
      throw error;
    }
  }

  /**
   * Awards a badge to a user
   */
  async awardBadge(data: AwardBadgeDto) {
    try {
      const { userId, badgeCode, awardedBy } = data;

      // Validate user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      // Find badge by code
      const badge = await this.prisma.badge.findUnique({
        where: { code: badgeCode },
      });

      if (!badge) {
        throw new NotFoundException(`Badge "${badgeCode}" not found`);
      }

      // Check if user already has this badge
      const existingBadge = await this.prisma.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId: badge.id,
          },
        },
      });

      if (existingBadge) {
        this.logger.log(`User ${userId} already has badge ${badgeCode}`);
        return existingBadge;
      }

      // Award badge
      const userBadge = await this.prisma.userBadge.create({
        data: {
          userId,
          badgeId: badge.id,
          awardedBy,
        },
        include: {
          badge: true,
        },
      });

      // Update user contribution score based on badge rarity
      const scoreBonus = this.getScoreBonusForRarity(badge.rarity as BadgeRarity);
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          contributionScore: {
            increment: scoreBonus,
          },
        },
      });

      this.logger.log(
        `Badge ${badgeCode} awarded to user ${userId}, score +${scoreBonus}`
      );

      return userBadge;
    } catch (error) {
      this.logger.error(`Error awarding badge ${data.badgeCode}:`, error);
      throw error;
    }
  }

  /**
   * Gets all badges for a user
   */
  async getUserBadges(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          badges: {
            include: {
              badge: true,
            },
            orderBy: {
              earnedAt: 'desc',
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      return {
        userId,
        contributionScore: user.contributionScore,
        badges: user.badges.map((ub) => ({
          id: ub.id,
          badge: ub.badge,
          earnedAt: ub.earnedAt,
        })),
        totalBadges: user.badges.length,
      };
    } catch (error) {
      this.logger.error(`Error fetching badges for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Gets all available badges
   */
  async getAllBadges() {
    try {
      const badges = await this.prisma.badge.findMany({
        orderBy: [{ rarity: 'desc' }, { createdAt: 'desc' }],
      });

      return {
        total: badges.length,
        badges,
        byRarity: {
          LEGENDARY: badges.filter((b) => b.rarity === 'LEGENDARY').length,
          EPIC: badges.filter((b) => b.rarity === 'EPIC').length,
          RARE: badges.filter((b) => b.rarity === 'RARE').length,
          COMMON: badges.filter((b) => b.rarity === 'COMMON').length,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching badges:', error);
      throw error;
    }
  }

  /**
   * Removes a badge from a user
   */
  async removeBadge(userId: string, badgeCode: string) {
    try {
      const badge = await this.prisma.badge.findUnique({
        where: { code: badgeCode },
      });

      if (!badge) {
        throw new NotFoundException(`Badge "${badgeCode}" not found`);
      }

      const userBadge = await this.prisma.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId: badge.id,
          },
        },
      });

      if (!userBadge) {
        throw new NotFoundException(`User does not have badge "${badgeCode}"`);
      }

      // Remove badge and update score
      await this.prisma.userBadge.delete({
        where: { id: userBadge.id },
      });

      const scoreReduction = this.getScoreBonusForRarity(badge.rarity as BadgeRarity);
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          contributionScore: {
            decrement: scoreReduction,
          },
        },
      });

      this.logger.log(`Badge ${badgeCode} removed from user ${userId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error removing badge from user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Gets leaderboard of top contributors
   */
  async getContributionLeaderboard(limit: number = 10) {
    try {
      const leaderboard = await this.prisma.user.findMany({
        where: { status: 'STUDENT' },
        select: {
          id: true,
          fullName: true,
          matricNumber: true,
          contributionScore: true,
          avatarUrl: true,
          badges: {
            include: { badge: true },
            take: 5, // Top 5 badges
          },
          college: {
            select: { code: true, name: true },
          },
          department: {
            select: { code: true, name: true },
          },
        },
        orderBy: {
          contributionScore: 'desc',
        },
        take: limit,
      });

      return {
        total: leaderboard.length,
        leaderboard: leaderboard.map((user, index) => ({
          rank: index + 1,
          user,
        })),
      };
    } catch (error) {
      this.logger.error('Error fetching leaderboard:', error);
      throw error;
    }
  }

  /**
   * Helper to calculate score bonus based on badge rarity
   */
  private getScoreBonusForRarity(rarity: BadgeRarity): number {
    const rarityScores: Record<BadgeRarity, number> = {
      COMMON: 10,
      RARE: 25,
      EPIC: 50,
      LEGENDARY: 100,
    };
    return rarityScores[rarity] || 10;
  }
}
