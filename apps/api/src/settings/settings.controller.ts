import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Logger,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { BadgeService } from '../core/services/badge.service';
import { PrivacyService, UpdatePrivacySettingsDto } from '../core/services/privacy.service';

/**
 * Settings Controller handles user preferences, privacy, badges, and account settings
 */
@Controller('settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(
    private readonly badgeService: BadgeService,
    private readonly privacyService: PrivacyService
  ) {}

  private requireAuthenticatedUser(req: Request): string {
    const userId = (req as Request & { user?: { id?: string } }).user?.id;

    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return userId;
  }

  private assertSelfAccess(req: Request, targetUserId: string): void {
    const userId = this.requireAuthenticatedUser(req);

    if (userId !== targetUserId) {
      throw new ForbiddenException('You can only modify your own settings');
    }
  }

  // ==================== Privacy Settings ====================

  /**
   * GET /settings/privacy/:userId
   * Retrieves privacy settings for a user
   */
  @Get('privacy/:userId')
  @UseGuards(SupabaseAuthGuard)
  async getPrivacySettings(@Req() req: Request, @Param('userId') userId: string) {
    this.assertSelfAccess(req, userId);
    this.logger.log(`Fetching privacy settings for user ${userId}`);
    return this.privacyService.getPrivacySettings(userId);
  }

  /**
   * PUT /settings/privacy/:userId
   * Updates privacy settings for a user
   */
  @Put('privacy/:userId')
  @UseGuards(SupabaseAuthGuard)
  async updatePrivacySettings(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Body() data: UpdatePrivacySettingsDto
  ) {
    this.assertSelfAccess(req, userId);
    this.logger.log(`Updating privacy settings for user ${userId}`);
    return this.privacyService.updatePrivacySettings(userId, data);
  }

  /**
   * POST /settings/stealth-mode/:userId
   * Toggles stealth mode (anonymous posts)
   */
  @Post('stealth-mode/:userId')
  @UseGuards(SupabaseAuthGuard)
  async toggleStealthMode(@Req() req: Request, @Param('userId') userId: string) {
    this.assertSelfAccess(req, userId);
    this.logger.log(`Toggling stealth mode for user ${userId}`);
    return this.privacyService.toggleStealthMode(userId);
  }

  /**
   * GET /settings/public-profile/:userId
   * Gets sanitized public profile based on privacy settings
   */
  @Get('public-profile/:userId')
  async getPublicProfile(
    @Param('userId') userId: string,
    @Query('requestingUserId') requestingUserId?: string
  ) {
    this.logger.log(`Fetching public profile for user ${userId}`);
    return this.privacyService.getPublicUserProfile(userId, requestingUserId);
  }

  // ==================== Badge Management ====================

  /**
   * GET /settings/badges/:userId
   * Retrieves all badges for a user with contribution score
   */
  @Get('badges/:userId')
  @UseGuards(SupabaseAuthGuard)
  async getUserBadges(@Req() req: Request, @Param('userId') userId: string) {
    this.assertSelfAccess(req, userId);
    this.logger.log(`Fetching badges for user ${userId}`);
    return this.badgeService.getUserBadges(userId);
  }

  /**
   * POST /settings/badges/:userId
   * Awards a badge to a user (admin only)
   */
  @Post('badges/:userId')
  @UseGuards(SupabaseAuthGuard)
  async awardBadge(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Body('badgeCode') badgeCode: string,
    @Body('awardedBy') awardedBy?: string
  ) {
    this.assertSelfAccess(req, userId);
    this.logger.log(`Awarding badge ${badgeCode} to user ${userId}`);
    return this.badgeService.awardBadge({
      userId,
      badgeCode,
      awardedBy,
    });
  }

  /**
   * DELETE /settings/badges/:userId/:badgeCode
   * Removes a badge from a user
   */
  @Delete('badges/:userId/:badgeCode')
  @UseGuards(SupabaseAuthGuard)
  async removeBadge(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Param('badgeCode') badgeCode: string
  ) {
    this.assertSelfAccess(req, userId);
    this.logger.log(`Removing badge ${badgeCode} from user ${userId}`);
    return this.badgeService.removeBadge(userId, badgeCode);
  }

  /**
   * GET /settings/badges/all
   * Gets all available badges
   */
  @Get('badges/all')
  async getAllBadges() {
    this.logger.log('Fetching all available badges');
    return this.badgeService.getAllBadges();
  }

  /**
   * GET /settings/leaderboard
   * Gets contribution leaderboard
   */
  @Get('leaderboard')
  async getLeaderboard() {
    this.logger.log('Fetching contribution leaderboard');
    return this.badgeService.getContributionLeaderboard(50);
  }
}
