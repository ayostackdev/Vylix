import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger
} from '@nestjs/common';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentGuard implements CanActivate {
  private readonly logger = new Logger(DepartmentGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userDeptId = this.cls.get<string>('departmentId');

    const paramsCourseId = request.params?.courseId;
    const bodyCourseId = (request.body as { courseId?: string } | undefined)?.courseId;
    const targetCourseId = (paramsCourseId ?? bodyCourseId) as string | undefined;

    if (!userDeptId) {
      this.logger.warn('Access attempt without established tenant context.');
      throw new ForbiddenException('Tenant context not established. Please re-authenticate.');
    }

    if (!targetCourseId) {
      return true;
    }

    const targetCourse = await this.prisma.course.findUnique({
      where: { id: targetCourseId },
      select: { departmentId: true, isGeneral: true }
    });

    if (!targetCourse) {
      throw new ForbiddenException('The requested course record does not exist.');
    }

    if (targetCourse.isGeneral) {
      return true;
    }

    if (targetCourse.departmentId === userDeptId) {
      return true;
    }

    this.logger.warn(`Silo breach blocked: User Dept attempted access on Course Dept [${targetCourse.departmentId}]`);
    throw new ForbiddenException('Access denied: This resource is strictly siloed to another department.');
  }
}
