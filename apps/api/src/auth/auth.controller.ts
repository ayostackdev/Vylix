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
} from '@nestjs/common';
import { EmailLinkingService, LinkEmailDto } from '../core/services/email-linking.service';

/**
 * Auth Controller handles email linking and verification operations.
 * These endpoints allow users to manage multiple email addresses linked to their account.
 */
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly emailLinkingService: EmailLinkingService) {}

  /**
   * POST /auth/link-email
   * Links a new email address to the authenticated user's account.
   * This is typically called after OAuth authentication or when user provides a personal email.
   */
  @Post('link-email')
  async linkEmail(@Body() linkEmailDto: LinkEmailDto) {
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
  async getUserEmails(@Param('userId') userId: string) {
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
    @Param('userId') userId: string,
    @Body('email') email: string
  ) {
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
    @Param('userId') userId: string,
    @Body('email') email: string
  ) {
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
    @Param('userId') userId: string,
    @Param('email') email: string
  ) {
    this.logger.log(`Removing email ${email} from user ${userId}`);
    return this.emailLinkingService.removeEmail(userId, email);
  }
}
