import { BadRequestException, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { MaintenanceKeyGuard } from './maintenance-key.guard';
import { MaintenanceService, NonceResult, PurgeReadinessReport, PurgeResult } from './maintenance.service';
import { MaterialsQueueAdminService } from './materials-queue-admin.service';

@Controller('maintenance')
@UseGuards(MaintenanceKeyGuard)
export class MaintenanceController {
  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly materialsQueueAdminService: MaterialsQueueAdminService,
  ) {}

  @Get('materials/queue')
  getQueueStats(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.materialsQueueAdminService.getStats(limit ?? 20);
  }

  @Post('materials/queue/:jobId/retry')
  retryFailedJob(@Param('jobId') jobId: string) {
    return this.materialsQueueAdminService.retryFailedJob(jobId);
  }

  /** Check purge readiness — no side effects, no nonce needed */
  @Get('purge-seed-data')
  checkReadiness(): Promise<PurgeReadinessReport> {
    return this.maintenanceService.checkPurgeReadiness();
  }

  /** Generate a single-use nonce to authorise a purge (nonce expires in 5 min) */
  @Post('purge-seed-data/confirm')
  confirmPurge(): Promise<NonceResult> {
    return this.maintenanceService.generateNonce();
  }

  /** Purge seed data — requires a nonce obtained from POST confirm first */
  @Delete('purge-seed-data')
  purgeSeedData(
    @Query('nonce') nonce?: string,
  ): Promise<PurgeResult> {
    if (!nonce) {
      throw new BadRequestException(
        'Nonce is required. Call POST /maintenance/purge-seed-data/confirm first to obtain one.',
      );
    }
    return this.maintenanceService.purgeWithNonce(nonce);
  }
}
