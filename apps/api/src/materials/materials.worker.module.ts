import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../core/prisma/prisma.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { MaterialsProcessingWorkerService } from './materials.worker.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, TelemetryModule],
  providers: [MaterialsProcessingWorkerService]
})
export class MaterialsWorkerModule {}