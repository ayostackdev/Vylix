import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class GraduationCronService {
  private readonly logger = new Logger(GraduationCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkAndMarkGraduatedStudents() {
    this.logger.log('Checking for students who have graduated...');

    const sessionStartYear = this.getActiveSessionStartYear();

    const students = await this.prisma.user.findMany({
      where: {
        status: 'STUDENT',
        entryYear: { not: null },
        collegeId: { not: null },
      },
      include: { college: { select: { durationYears: true } } },
    });

    let graduatedCount = 0;

    for (const student of students) {
      const yearsElapsed = sessionStartYear - student.entryYear! + 1;

      if (yearsElapsed > student.college!.durationYears) {
        await this.prisma.user.update({
          where: { id: student.id },
          data: {
            status: 'ALUMNI',
            currentLevel: 'Alumni',
          },
        });
        graduatedCount++;
        this.logger.log(
          `Marked user ${student.id} (${student.fullName}) as ALUMNI — ${yearsElapsed} years elapsed, duration: ${student.college!.durationYears}`
        );
      }
    }

    this.logger.log(`Graduation check complete. Marked ${graduatedCount} student(s) as alumni.`);
  }

  private getActiveSessionStartYear(): number {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return currentMonth >= 7 ? currentYear : currentYear - 1;
  }
}
