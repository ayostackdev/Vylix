import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class AlumniService {
  private readonly logger = new Logger(AlumniService.name);

  // NUC-approved program durations (in years)
  private readonly PROGRAM_DURATIONS: Record<string, number> = {
    'COLPHYS': 4,
    'COLCOM': 4,
    'COLENG': 5,
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates the current academic session based on the current date.
   * FUNAAB sessions typically start in August/September.
   */
  private getCurrentAcademicSession(): number {
    const now = new Date();
    // If month is before August (0-7), session is previous year
    // If month is August or later (7+), session is current year
    return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  }

  /**
   * Checks if a student should be marked as alumni based on their entry year and college.
   */
  private shouldMarkAsAlumni(
    entryYear: number,
    currentAcademicSession: number,
    collegeCode: string
  ): boolean {
    const duration = this.PROGRAM_DURATIONS[collegeCode] || 4;
    const expectedGraduationSession = entryYear + duration;
    return currentAcademicSession >= expectedGraduationSession;
  }

  /**
   * Main cron job that runs annually to detect and update alumni status.
   * Scheduled for August 1st at 00:00 UTC (beginning of academic session).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async detectAndProcessAlumni(): Promise<void> {
    this.logger.log('Starting alumni detection process...');

    try {
      const currentSession = this.getCurrentAcademicSession();

      // Fetch all students (not yet marked as alumni)
      const students = await this.prisma.user.findMany({
        where: {
          status: 'STUDENT',
        },
        include: {
          college: {
            select: { code: true },
          },
          emails: true,
        },
      });

      let processedCount = 0;

      for (const student of students) {
        if (this.shouldMarkAsAlumni(student.entryYear, currentSession, student.college.code)) {
          await this.promoteStudentToAlumni(student.id);
          processedCount++;
        }
      }

      this.logger.log(
        `Alumni detection completed. ${processedCount} students promoted to alumni status.`
      );
    } catch (error) {
      this.logger.error('Error during alumni detection process:', error);
      throw error;
    }
  }

  /**
   * Promotes a student to alumni status and switches primary email to personal email.
   */
  private async promoteStudentToAlumni(userId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (prisma) => {
        // Find the user's emails
        const userEmails = await prisma.userEmail.findMany({
          where: { userId },
        });

        // Find institutional and personal emails
        const institutionalEmail = userEmails.find((e) =>
          e.email.endsWith('@student.funaab.edu.ng')
        );
        const personalEmail = userEmails.find(
          (e) => !e.email.endsWith('@student.funaab.edu.ng')
        );

        // Start a transaction to atomically update all related records
        const updates = [];

        // Update institutional email to non-primary
        if (institutionalEmail) {
          updates.push(
            prisma.userEmail.update({
              where: { id: institutionalEmail.id },
              data: { isPrimary: false },
            })
          );
        }

        // Update personal email to primary (if it exists)
        if (personalEmail) {
          updates.push(
            prisma.userEmail.update({
              where: { id: personalEmail.id },
              data: { isPrimary: true },
            })
          );
        }

        // Update user status to ALUMNI and set graduated date
        updates.push(
          prisma.user.update({
            where: { id: userId },
            data: {
              status: 'ALUMNI',
              graduatedAt: new Date(),
            },
          })
        );

        // Execute all updates atomically
        await Promise.all(updates);

        this.logger.log(
          `User ${userId} promoted to alumni. Primary email switched from institutional to personal.`
        );
      });
    } catch (error) {
      this.logger.error(`Error promoting user ${userId} to alumni:`, error);
      throw error;
    }
  }
}
