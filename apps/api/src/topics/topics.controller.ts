import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DepartmentGuard } from '../core/guards/department.guard';
import { TopicsService } from './topics.service';

@Controller('topics')
@UseGuards(DepartmentGuard)
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get('course/:courseId')
  getByCourse(@Param('courseId') courseId: string) {
    return this.topicsService.getByCourse(courseId);
  }
}
