import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpdatePrivacySettingsDto {
  isStealthMode?: boolean;
  showContributions?: boolean;
  showEmail?: boolean;
  showDepartment?: boolean;
}

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gets privacy settings for a user, creates default if not exists
   */
  async getPrivacySettings(userId: string) {
    try {
      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      // Find or create privacy settings
      let privacy = await this.prisma.userPrivacy.findUnique({
        where: { userId },
      });

      if (!privacy) {
        privacy = await this.prisma.userPrivacy.create({
          data: {
            userId,
            isStealthMode: false,
            showContributions: true,
            showEmail: false,
            showDepartment: true,
          },
        });
        this.logger.log(`Privacy settings created for user ${userId}`);
      }

      return privacy;
    } catch (error) {
      this.logger.error(`Error getting privacy settings for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Updates privacy settings for a user
   */
  async updatePrivacySettings(userId: string, data: UpdatePrivacySettingsDto) {
    try {
      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      // Get or create privacy settings
      let privacy = await this.prisma.userPrivacy.findUnique({
        where: { userId },
      });

      if (!privacy) {
        privacy = await this.prisma.userPrivacy.create({
          data: {
            userId,
            ...data,
          },
        });
      } else {
        privacy = await this.prisma.userPrivacy.update({
          where: { userId },
          data,
        });
      }

      this.logger.log(`Privacy settings updated for user ${userId}`);
      return privacy;
    } catch (error) {
      this.logger.error(`Error updating privacy settings for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Toggles stealth mode for a user
   * When stealth mode is ON, their posts appear as "Anonymous Student"
   */
  async toggleStealthMode(userId: string) {
    try {
      const privacy = await this.getPrivacySettings(userId);

      const updated = await this.prisma.userPrivacy.update({
        where: { userId },
        data: {
          isStealthMode: !privacy.isStealthMode,
        },
      });

      const modeStatus = updated.isStealthMode ? 'enabled' : 'disabled';
      this.logger.log(`Stealth mode ${modeStatus} for user ${userId}`);

      return {
        success: true,
        isStealthMode: updated.isStealthMode,
        message: `Stealth mode ${modeStatus}. Your posts will appear as "Anonymous Student".`,
      };
    } catch (error) {
      this.logger.error(`Error toggling stealth mode for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Gets the public display name for a user
   * Takes stealth mode into account
   */
  async getPublicDisplayName(userId: string): Promise<string> {
    try {
      const privacy = await this.getPrivacySettings(userId);

      if (privacy.isStealthMode) {
        return 'Anonymous Student';
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });

      return user?.fullName || 'Anonymous Student';
    } catch (error) {
      this.logger.error(`Error getting public display name for user ${userId}:`, error);
      return 'Anonymous Student';
    }
  }

  /**
   * Gets sanitized user profile data based on privacy settings
   */
  async getPublicUserProfile(userId: string, requestingUserId?: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          privacy: true,
          emails: true,
          badges: {
            include: { badge: true },
            take: 10,
          },
          college: {
            select: { code: true, name: true },
          },
          department: {
            select: { code: true, name: true },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      const isOwnProfile = userId === requestingUserId;
      const privacy = user.privacy || {
        isStealthMode: false,
        showContributions: true,
        showEmail: false,
        showDepartment: true,
      };

      return {
        id: user.id,
        name: privacy.isStealthMode && !isOwnProfile ? 'Anonymous Student' : user.fullName,
        email: (privacy.showEmail || isOwnProfile) ? user.emails?.[0]?.email : undefined,
        college: privacy.showDepartment ? user.college : undefined,
        department: privacy.showDepartment ? user.department : undefined,
        level: user.currentLevel,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        isStealthMode: privacy.isStealthMode,
        contributions: privacy.showContributions
          ? {
              score: user.contributionScore,
              badges: user.badges.map((ub) => ub.badge),
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error(`Error getting public profile for user ${userId}:`, error);
      throw error;
    }
  }
}
