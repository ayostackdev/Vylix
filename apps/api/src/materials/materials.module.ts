import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../core/prisma/prisma.module';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { MaterialsController } from './materials.controller';
import { MaterialsService } from './materials.service';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [ConfigModule, PrismaModule, TelemetryModule],
  controllers: [MaterialsController],
  providers: [MaterialsService, SupabaseAuthGuard]
})
export class MaterialsModule {}