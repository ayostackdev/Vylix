import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { EmailLinkingService } from '../core/services/email-linking.service';
import { StreakService } from '../core/services/streak.service';
import { PrismaService } from '../core/prisma/prisma.service';

const BACKUP_LINK_POINTS = 50;

const EMAIL_MILESTONES = [3, 8, 15, 25];

export function getNextMilestone(currentCount: number): number | null {
  return EMAIL_MILESTONES.find((m) => m > currentCount) ?? null;
}

export function shouldPromptBackupEmail(
  vaultCount: number,
  hasBackupEmail: boolean,
  dismissedAt: Date | null
): boolean {
  if (hasBackupEmail) return false;
  if (vaultCount < 3) return false;

  if (!dismissedAt) return vaultCount >= 3;

  const daysSinceDismiss = Math.floor(
    (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceDismiss < 14) return false;

  const milestone = getNextMilestone(vaultCount - 1);
  return milestone !== null && vaultCount >= milestone;
}

interface LinkBackupEmailDto {
  email: string;
}

@Controller('user')
@UseGuards(SupabaseAuthGuard)
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailLinkingService: EmailLinkingService,
    private readonly streakService: StreakService
  ) {}

  private requireUserId(req: Request): string {
    const user = (req as any).user as { id?: string } | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }
    return user.id;
  }

  @Post('link-backup-email')
  async linkBackupEmail(
    @Req() req: Request,
    @Body() dto: LinkBackupEmailDto
  ) {
    const userId = this.requireUserId(req);

    const result = await this.emailLinkingService.linkEmailToUser({
      userId,
      email: dto.email,
      provider: 'email',
    });

    await this.streakService.awardPoints(
      userId,
      BACKUP_LINK_POINTS,
      'backup_email_linked',
      'Linked a personal backup email to secure vault access'
    );

    this.logger.log(
      `User ${userId} linked backup email ${dto.email} and earned ${BACKUP_LINK_POINTS} points`
    );

    return {
      success: true,
      message: `Backup email ${dto.email} linked. You earned ${BACKUP_LINK_POINTS} contribution points!`,
      data: result,
    };
  }

  @Post('dismiss-email-prompt')
  async dismissEmailPrompt(@Req() req: Request) {
    const userId = this.requireUserId(req);

    await this.prisma.user.update({
      where: { id: userId },
      data: { emailPromptDismissedAt: new Date() },
    });

    this.logger.log(`User ${userId} dismissed backup email prompt`);

    return {
      success: true,
      message: 'Reminder dismissed. We will ask again in 14 days.',
    };
  }

  @Get('profile')
  async getProfile(@Req() req: Request) {
    const userId = this.requireUserId(req);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        matricNumber: true,
        entryYear: true,
        currentLevel: true,
        status: true,
        bio: true,
        avatarUrl: true,
        contributionScore: true,
        college: { select: { id: true, code: true, name: true, durationYears: true } },
        department: { select: { id: true, code: true, name: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { data: user };
  }

  @Get('export-data')
  async exportData(@Req() req: Request) {
    const userId = this.requireUserId(req);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        matricNumber: true,
        entryYear: true,
        status: true,
        currentLevel: true,
        college: { select: { code: true, name: true } },
        department: { select: { code: true, name: true } },
      },
    });

    const materials = await this.prisma.material.findMany({
      where: { uploaderId: userId },
      select: { id: true, fileName: true, fileUrl: true, uploadedAt: true },
    });

    const vaultItems = await this.prisma.vaultItem.findMany({
      where: { userId },
      select: { id: true, title: true, savedAt: true },
    });

    return {
      data: {
        exportedAt: new Date().toISOString(),
        profile: user,
        materials,
        vaultItems,
      },
    };
  }

  @Get('backup-status')
  async getBackupStatus(@Req() req: Request) {
    const userId = this.requireUserId(req);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { emails: true, vaultItems: { select: { id: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const hasBackupEmail = user.emails.length > 1;
    const vaultCount = user.vaultItems.length;

    return {
      hasBackupEmail,
      emailPromptDismissedAt: user.emailPromptDismissedAt,
      vaultCount,
      shouldPrompt: shouldPromptBackupEmail(
        vaultCount,
        hasBackupEmail,
        user.emailPromptDismissedAt
      ),
      nextMilestone: getNextMilestone(vaultCount),
    };
  }
}
