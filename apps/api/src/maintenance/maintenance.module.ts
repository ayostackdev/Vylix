import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MaterialsQueueAdminService } from './materials-queue-admin.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceKeyGuard } from './maintenance-key.guard';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [ConfigModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaterialsQueueAdminService, MaintenanceKeyGuard]
})
export class MaintenanceModule {}
