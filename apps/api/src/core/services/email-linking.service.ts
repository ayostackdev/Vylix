import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface UserEmailRecord {
  id: string;
  email: string;
  isPrimary: boolean;
  isVerified: boolean;
  createdAt?: Date;
}

export interface GetUserEmailsResponse {
  userId: string;
  emails: UserEmailRecord[];
  primaryEmail?: string;
}

export interface LinkEmailDto {
  userId: string;
  email: string;
  provider?: 'google' | 'github' | 'email';
}

export interface LinkEmailResponse {
  success: boolean;
  message: string;
  email?: string;
  primaryEmail?: string;
}

@Injectable()
export class EmailLinkingService {
  private readonly logger = new Logger(EmailLinkingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Links a new email to an existing user account.
   * Ensures the email isn't already in use and creates a new UserEmail record.
   */
  async linkEmailToUser(data: LinkEmailDto): Promise<LinkEmailResponse> {
    const { userId, email, provider = 'email' } = data;

    try {
      // Validate user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { emails: true },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      const linkedEmails = (user.emails ?? []) as UserEmailRecord[];

      // Check if email is already linked to another user
      const existingEmail = await this.prisma.userEmail.findUnique({
        where: { email },
      });

      if (existingEmail) {
        throw new ConflictException(`Email ${email} is already linked to another account`);
      }

      // Check if this user already has this email (shouldn't happen but defensive check)
      if (linkedEmails.some((emailRecord: UserEmailRecord) => emailRecord.email === email)) {
        return {
          success: true,
          message: 'Email is already linked to this account',
          email,
          primaryEmail: linkedEmails.find((emailRecord: UserEmailRecord) => emailRecord.isPrimary)?.email,
        };
      }

      // Create new email record
      const newEmail = await this.prisma.userEmail.create({
        data: {
          email,
          userId,
          isPrimary: false, // Initially not primary
          isVerified: provider !== 'email', // OAuth emails are pre-verified
        },
      });

      this.logger.log(
        `Email ${email} successfully linked to user ${userId} via ${provider}`
      );

      return {
        success: true,
        message: `Email ${email} linked successfully`,
        email: newEmail.email,
        primaryEmail: linkedEmails.find((emailRecord: UserEmailRecord) => emailRecord.isPrimary)?.email,
      };
    } catch (error) {
      this.logger.error(`Error linking email to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Sets a specific email as the primary email for a user.
   * Ensures the email belongs to the user before updating.
   */
  async setPrimaryEmail(userId: string, email: string): Promise<LinkEmailResponse> {
    try {
      // Validate the email belongs to this user
      const userEmail = await this.prisma.userEmail.findFirst({
        where: {
          email,
          userId,
        },
      });

      if (!userEmail) {
        throw new NotFoundException(
          `Email ${email} is not linked to user ${userId}`
        );
      }

      // Atomically update primary email
      await this.prisma.$transaction(async (prisma: Prisma.TransactionClient) => {
        // Set all emails to non-primary
        await prisma.userEmail.updateMany({
          where: { userId },
          data: { isPrimary: false },
        });

        // Set the specified email to primary
        await prisma.userEmail.update({
          where: { id: userEmail.id },
          data: { isPrimary: true },
        });
      });

      this.logger.log(`Primary email updated to ${email} for user ${userId}`);

      return {
        success: true,
        message: `Primary email updated to ${email}`,
        primaryEmail: email,
      };
    } catch (error) {
      this.logger.error(`Error setting primary email for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Gets all emails linked to a user.
   */
  async getUserEmails(userId: string): Promise<GetUserEmailsResponse> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          emails: {
            select: {
              id: true,
              email: true,
              isPrimary: true,
              isVerified: true,
              createdAt: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      return {
        userId,
        emails: user.emails as UserEmailRecord[],
        primaryEmail: (user.emails as UserEmailRecord[]).find((emailRecord: UserEmailRecord) => emailRecord.isPrimary)?.email,
      };
    } catch (error) {
      this.logger.error(`Error fetching emails for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Verifies an email belonging to a user.
   * In production, this would typically be called after email verification token validation.
   */
  async verifyEmail(userId: string, email: string): Promise<LinkEmailResponse> {
    try {
      const userEmail = await this.prisma.userEmail.findFirst({
        where: { email, userId },
      });

      if (!userEmail) {
        throw new NotFoundException(
          `Email ${email} is not linked to user ${userId}`
        );
      }

      await this.prisma.userEmail.update({
        where: { id: userEmail.id },
        data: { isVerified: true },
      });

      this.logger.log(`Email ${email} verified for user ${userId}`);

      return {
        success: true,
        message: `Email ${email} verified successfully`,
        email,
      };
    } catch (error) {
      this.logger.error(`Error verifying email for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Removes an email from a user account.
   * Prevents removal of the last email or primary email without a backup.
   */
  async removeEmail(userId: string, email: string): Promise<LinkEmailResponse> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { emails: true },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      const linkedEmails = (user.emails ?? []) as UserEmailRecord[];
      const emailToRemove = linkedEmails.find((emailRecord: UserEmailRecord) => emailRecord.email === email);

      if (!emailToRemove) {
        throw new NotFoundException(
          `Email ${email} is not linked to user ${userId}`
        );
      }

      // Prevent removal of the only email
      if (linkedEmails.length === 1) {
        throw new ConflictException(
          'Cannot remove the last email. User must have at least one email.'
        );
      }

      // If removing primary email, ensure there's another email to become primary
      if (emailToRemove.isPrimary && linkedEmails.length > 1) {
        await this.prisma.$transaction(async (prisma: Prisma.TransactionClient) => {
          // Find another email to set as primary
          const newPrimary = linkedEmails.find((emailRecord: UserEmailRecord) => emailRecord.id !== emailToRemove.id);

          if (newPrimary) {
            await prisma.userEmail.update({
              where: { id: newPrimary.id },
              data: { isPrimary: true },
            });
          }

          // Remove the email
          await prisma.userEmail.delete({
            where: { id: emailToRemove.id },
          });
        });
      } else {
        await this.prisma.userEmail.delete({
          where: { id: emailToRemove.id },
        });
      }

      this.logger.log(`Email ${email} removed from user ${userId}`);

      return {
        success: true,
        message: `Email ${email} removed successfully`,
      };
    } catch (error) {
      this.logger.error(`Error removing email from user ${userId}:`, error);
      throw error;
    }
  }
}
