import { Controller, Get, UseGuards, Req, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { CoursesService } from './courses.service';

@Controller('courses')
@UseGuards(SupabaseAuthGuard)
export class CoursesController {
  private readonly logger = new Logger(CoursesController.name);

  constructor(private readonly coursesService: CoursesService) {}

  @Get('my')
  async getMyCourses(@Req() req: Request) {
    const user = (req as any).user as { id?: string } | undefined;
    if (!user?.id) return [];
    return this.coursesService.getMyCourses(user.id);
  }
}
