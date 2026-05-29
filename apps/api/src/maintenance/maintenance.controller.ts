import { Controller, Get, Post, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { MaintenanceKeyGuard } from './maintenance-key.guard';
import { MaterialsQueueAdminService } from './materials-queue-admin.service';

@Controller('maintenance')
@UseGuards(MaintenanceKeyGuard)
export class MaintenanceController {
  constructor(private readonly materialsQueueAdminService: MaterialsQueueAdminService) {}

  @Get('materials/queue')
  getQueueStats(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.materialsQueueAdminService.getStats(limit ?? 20);
  }

  @Post('materials/queue/:jobId/retry')
  retryFailedJob(@Param('jobId') jobId: string) {
    return this.materialsQueueAdminService.retryFailedJob(jobId);
  }
}