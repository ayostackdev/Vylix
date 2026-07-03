import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { CacheService } from '../core/services/cache.service';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService
  ) {}

  async getMyCourses(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { currentLevel: true, departmentId: true, entryYear: true },
    });

    if (!user?.departmentId) return [];

    const level = user.currentLevel
      ? parseInt(user.currentLevel.replace(/\D/g, ''), 10) || 100
      : user.entryYear
        ? (new Date().getFullYear() - user.entryYear + 1) * 100
        : 100;

    const courses = await this.prisma.course.findMany({
      where: {
        level,
        departmentId: user.departmentId,
      },
      orderBy: { code: 'asc' },
    });

    const courseIds = courses.map((c) => c.id);

    const questionCounts = await this.getPastQuestionCounts(courseIds);

    return courses.map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
      level: course.level,
      isGeneral: course.isGeneral,
      pastQuestionCount: questionCounts[course.id] ?? 0,
    }));
  }

  private async getPastQuestionCounts(courseIds: string[]): Promise<Record<string, number>> {
    if (courseIds.length === 0) return {};

    const cacheKey = `courses:pq-counts:${courseIds.sort().join(',')}`;
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const result = await this.prisma.material.groupBy({
          by: ['topicId'],
          where: {
            isPastQuestion: true,
            topic: { courseId: { in: courseIds } },
          },
          _count: { id: true },
        });

        const topicCourseMap = await this.prisma.topic.findMany({
          where: { courseId: { in: courseIds } },
          select: { id: true, courseId: true },
        });

        const topicToCourse: Record<string, string> = {};
        for (const t of topicCourseMap) {
          topicToCourse[t.id] = t.courseId;
        }

        const counts: Record<string, number> = {};
        for (const row of result) {
          const courseId = topicToCourse[row.topicId];
          if (courseId) {
            counts[courseId] = (counts[courseId] ?? 0) + row._count.id;
          }
        }

        return counts;
      },
      300
    );
  }
}
