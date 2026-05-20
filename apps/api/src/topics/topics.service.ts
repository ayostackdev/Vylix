import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  getByCourse(courseId: string) {
    return this.prisma.topic.findMany({
      where: { courseId, isActive: true },
      orderBy: { lastActivity: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            departmentId: true
          }
        }
      }
    });
  }
}
