import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Logger,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { EmailLinkingService, LinkEmailDto } from '../core/services/email-linking.service';

/**
 * Auth Controller handles email linking and verification operations.
 * These endpoints allow users to manage multiple email addresses linked to their account.
 */
@Controller('auth')
@UseGuards(SupabaseAuthGuard)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly emailLinkingService: EmailLinkingService) {}

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
      throw new ForbiddenException('You can only manage your own account');
    }
  }

  /**
   * POST /auth/link-email
   * Links a new email address to the authenticated user's account.
   * This is typically called after OAuth authentication or when user provides a personal email.
   */
  @Post('link-email')
  async linkEmail(@Req() req: Request, @Body() linkEmailDto: LinkEmailDto) {
    this.assertSelfAccess(req, linkEmailDto.userId);
    this.logger.log(
      `Linking email ${linkEmailDto.email} to user ${linkEmailDto.userId}`
    );
    return this.emailLinkingService.linkEmailToUser(linkEmailDto);
  }

  /**
   * GET /auth/emails/:userId
   * Retrieves all emails linked to a user account.
   * Returns the primary email and verification status for each email.
   */
  @Get('emails/:userId')
  async getUserEmails(@Req() req: Request, @Param('userId') userId: string) {
    this.assertSelfAccess(req, userId);
    this.logger.log(`Fetching emails for user ${userId}`);
    return this.emailLinkingService.getUserEmails(userId);
  }

  /**
   * PUT /auth/primary-email/:userId
   * Sets a specific email as the primary email for the user.
   * Only verified emails can be set as primary (optional validation).
   */
  @Put('primary-email/:userId')
  async setPrimaryEmail(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Body('email') email: string
  ) {
    this.assertSelfAccess(req, userId);
    this.logger.log(`Setting ${email} as primary email for user ${userId}`);
    return this.emailLinkingService.setPrimaryEmail(userId, email);
  }

  /**
   * POST /auth/verify-email/:userId
   * Marks an email as verified after the user completes email verification flow.
   * In production, should validate a verification token first.
   */
  @Post('verify-email/:userId')
  async verifyEmail(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Body('email') email: string
  ) {
    this.assertSelfAccess(req, userId);
    this.logger.log(`Verifying email ${email} for user ${userId}`);
    return this.emailLinkingService.verifyEmail(userId, email);
  }

  /**
   * DELETE /auth/emails/:userId/:email
   * Removes an email address from the user's account.
   * Prevents removal of the last email or primary email without a backup.
   */
  @Delete('emails/:userId/:email')
  async removeEmail(
    @Req() req: Request,
    @Param('userId') userId: string,
    @Param('email') email: string
  ) {
    this.assertSelfAccess(req, userId);
    this.logger.log(`Removing email ${email} from user ${userId}`);
    return this.emailLinkingService.removeEmail(userId, email);
  }
}
