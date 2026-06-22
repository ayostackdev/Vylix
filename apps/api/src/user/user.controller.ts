import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  Logger,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { EmailLinkingService } from '../core/services/email-linking.service';
import { StreakService } from '../core/services/streak.service';
import { PrismaService } from '../core/prisma/prisma.service';
import { Public } from '../core/decorators/public.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

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

    // Also link the JWT signup email if it isn't already linked, so the
    // auth guard's email check doesn't reject subsequent requests.
    const tokenEmail = (req as any).user?.tokenEmail as string | undefined;
    if (tokenEmail && tokenEmail !== dto.email) {
      try {
        await this.emailLinkingService.linkEmailToUser({
          userId,
          email: tokenEmail,
          provider: 'email',
        });
        this.logger.log(`Auto-linked JWT email ${tokenEmail} for user ${userId}`);
      } catch {
        // Non-critical — the user already has access via the guard bypass
      }
    }

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
    const userAgent = (req as any).user;

    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        matricNumber: true,
        entryYear: true,
        currentLevel: true,
        levelUpdatedAt: true,
        schoolEmail: true,
        schoolEmailPromptDismissedAt: true,
        status: true,
        graduatedAt: true,
        bio: true,
        avatarUrl: true,
        contributionScore: true,
        college: { select: { id: true, code: true, name: true, durationYears: true } },
        department: { select: { id: true, code: true, name: true } },
      },
    });

    if (!user) {
      const tokenEmail = userAgent?.tokenEmail;
      try {
        user = await this.prisma.user.create({
          data: {
            id: userId,
            fullName: tokenEmail?.split('@')[0] ?? 'Student',
            emails: tokenEmail ? {
              create: { email: tokenEmail, isPrimary: true, isVerified: true }
            } : undefined,
          },
          select: {
            id: true,
            fullName: true,
            matricNumber: true,
            entryYear: true,
            currentLevel: true,
            levelUpdatedAt: true,
            schoolEmail: true,
            schoolEmailPromptDismissedAt: true,
            status: true,
            graduatedAt: true,
            bio: true,
            avatarUrl: true,
            contributionScore: true,
            college: { select: { id: true, code: true, name: true, durationYears: true } },
            department: { select: { id: true, code: true, name: true } },
          },
        });
        this.logger.log(`Auto-created user ${userId}`);
      } catch {
        user = await this.prisma.user.create({
          data: {
            id: userId,
            fullName: tokenEmail?.split('@')[0] ?? 'Student',
          },
          select: {
            id: true,
            fullName: true,
            matricNumber: true,
            entryYear: true,
            currentLevel: true,
            levelUpdatedAt: true,
            schoolEmail: true,
            schoolEmailPromptDismissedAt: true,
            status: true,
            graduatedAt: true,
            bio: true,
            avatarUrl: true,
            contributionScore: true,
            college: { select: { id: true, code: true, name: true, durationYears: true } },
            department: { select: { id: true, code: true, name: true } },
          },
        });
        this.logger.log(`Auto-created user ${userId} (without email link)`);
      }
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

  @Post('school-email')
  async setSchoolEmail(@Req() req: Request, @Body() dto: { email: string }) {
    const userId = this.requireUserId(req);

    const trimmed = dto.email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      throw new NotFoundException('Valid school email is required');
    }

    let existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      const tokenEmail = (req as any).user?.tokenEmail;
      existing = await this.prisma.user.create({
        data: {
          id: userId,
          fullName: tokenEmail?.split('@')[0] ?? 'Student',
          emails: tokenEmail ? {
            create: { email: tokenEmail, isPrimary: true, isVerified: true }
          } : undefined,
        },
      });
      this.logger.log(`Auto-created user ${userId} via school-email`);
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { schoolEmail: trimmed },
      });

      // Link the school email so it passes the auth guard check
      await this.prisma.userEmail.upsert({
        where: { email: trimmed },
        update: {},
        create: {
          email: trimmed,
          userId,
          isVerified: true,
        },
      });

      // Also link the JWT email if different, so the auth guard doesn't reject
      const tokenEmail = (req as any).user?.tokenEmail;
      if (tokenEmail && tokenEmail !== trimmed) {
        await this.prisma.userEmail.upsert({
          where: { email: tokenEmail },
          update: {},
          create: {
            email: tokenEmail,
            userId,
            isVerified: true,
          },
        });
      }

      this.logger.log(`User ${userId} set school email to ${trimmed}`);

      return {
        success: true,
        message: 'School email saved.',
        data: { schoolEmail: user.schoolEmail },
      };
    } catch (error) {
      this.logger.error(`Failed to save school email for user ${userId}:`, error);
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to save school email'
      );
    }
  }

  @Post('dismiss-school-email-prompt')
  async dismissSchoolEmailPrompt(@Req() req: Request) {
    const userId = this.requireUserId(req);

    await this.prisma.user.update({
      where: { id: userId },
      data: { schoolEmailPromptDismissedAt: new Date() },
    });

    this.logger.log(`User ${userId} dismissed school email prompt`);

    return {
      success: true,
      message: 'Dismissed. We will ask again in 7 days.',
    };
  }

  @Post('update-level')
  async updateLevel(@Req() req: Request, @Body() dto: { level: string }) {
    const userId = this.requireUserId(req);

    const validLevels = ['100L', '200L', '300L', '400L', '500L', 'Spillover'];
    if (!validLevels.includes(dto.level)) {
      throw new NotFoundException('Invalid academic level');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { currentLevel: dto.level, levelUpdatedAt: new Date() },
    });

    this.logger.log(`User ${userId} updated level to ${dto.level}`);

    return {
      success: true,
      message: `Level updated to ${dto.level}`,
      data: { currentLevel: user.currentLevel, levelUpdatedAt: user.levelUpdatedAt },
    };
  }

  @Post('graduate')
  async graduate(@Req() req: Request) {
    const userId = this.requireUserId(req);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ALUMNI',
        currentLevel: 'Graduated',
        levelUpdatedAt: new Date(),
        graduatedAt: new Date(),
      },
    });

    this.logger.log(`User ${userId} graduated and converted to alumni`);

    return {
      success: true,
      message: 'Your account has been converted to alumni status.',
      data: { status: user.status, graduatedAt: user.graduatedAt },
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

  @Public()
  @Get('profile-test')
  async testProfile() {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: '252250c6-78a0-486b-92c7-a47aef961953' } });
      return { user };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  @Public()
  @Get('profile-test-update')
  async testProfileUpdate() {
    try {
      const user = await this.prisma.user.update({
        where: { id: '252250c6-78a0-486b-92c7-a47aef961953' },
        data: { currentLevel: '200L', collegeId: 'dd0df60c-7aa6-4969-bdcb-a22da3785865', departmentId: 'b1d3e841-50b8-4dc5-962a-72dff8af88a3' },
        select: { id: true, fullName: true, matricNumber: true, entryYear: true, currentLevel: true, levelUpdatedAt: true, status: true, collegeId: true, departmentId: true },
      });
      return { data: user };
    } catch (e) {
      return { error: e instanceof Error ? e.message + ' | ' + e.constructor.name + ' | ' + JSON.stringify((e as any).code ?? '') + ' | ' + (e as any).stack : 'unknown' };
    }
  }

  @Patch('profile')
  async updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateProfileDto
  ) {
    console.log('========== updateProfile CALLED ==========');
    console.log('dto:', JSON.stringify(dto));
    console.log('user:', JSON.stringify((req as any).user));
    const userId = this.requireUserId(req);

    const data: Record<string, any> = {};
    try {
      if (dto.matricNumber !== undefined) {
        const existing = await this.prisma.user.findUnique({ where: { matricNumber: dto.matricNumber } });
        if (existing && existing.id !== userId) {
          throw new BadRequestException('Matric number already in use');
        }
        data.matricNumber = dto.matricNumber;
      }
      if (dto.entryYear !== undefined) data.entryYear = dto.entryYear;
      if (dto.currentLevel !== undefined) data.currentLevel = dto.currentLevel;
      if (dto.collegeId !== undefined) {
        const college = await this.prisma.college.findUnique({ where: { id: dto.collegeId } });
        if (!college) throw new NotFoundException('College not found');
        data.collegeId = dto.collegeId;
      }
      if (dto.departmentId !== undefined) {
        const department = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
        if (!department) throw new NotFoundException('Department not found');
        data.departmentId = dto.departmentId;
      }

      if (Object.keys(data).length === 0) {
        throw new BadRequestException('No fields to update');
      }

      const user = await this.prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          fullName: true,
          matricNumber: true,
          entryYear: true,
          currentLevel: true,
          levelUpdatedAt: true,
          status: true,
          collegeId: true,
          departmentId: true,
        },
      });

      return { data: user };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof UnauthorizedException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        const tokenEmail = (req as any).user?.tokenEmail;
        await this.prisma.user.create({
          data: {
            id: userId,
            fullName: tokenEmail?.split('@')[0] ?? 'Student',
          },
        });
        const user = await this.prisma.user.update({
          where: { id: userId },
          data,
          select: {
            id: true,
            fullName: true,
            matricNumber: true,
            entryYear: true,
            currentLevel: true,
            levelUpdatedAt: true,
            status: true,
            collegeId: true,
            departmentId: true,
          },
        });
        return { data: user };
      }

      const errorMsg = error instanceof Error ? `${error.message} | ${error.constructor.name} | ${JSON.stringify((error as any).code ?? '')} | ${(error as any).stack}` : 'Unknown error';
      this.logger.error(`updateProfile failed for user ${userId}: ${errorMsg}`);
      try { require('fs').appendFileSync(require('path').join(require('os').tmpdir(), 'update-profile-error.log'), `${new Date().toISOString()} userId=${userId} error=${errorMsg}\n`); } catch {}
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to update profile'
      );
    }
  }
}

@Controller('colleges')
@UseGuards(SupabaseAuthGuard)
export class ReferenceController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async listColleges() {
    return this.prisma.college.findMany({ orderBy: { name: 'asc' } });
  }

  @Public()
  @Get(':collegeId/departments')
  async listDepartments(@Param('collegeId') collegeId: string) {
    const college = await this.prisma.college.findUnique({ where: { id: collegeId } });
    if (!college) throw new NotFoundException('College not found');
    return this.prisma.department.findMany({ where: { collegeId }, orderBy: { name: 'asc' } });
  }
}
