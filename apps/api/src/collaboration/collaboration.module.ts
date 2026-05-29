import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { CollaborationController } from './collaboration.controller';
import { CollaborationService } from './collaboration.service';

@Module({
  imports: [PrismaModule, AuthModule, TelemetryModule],
  controllers: [CollaborationController],
  providers: [CollaborationService],
  exports: [CollaborationService]
})
export class CollaborationModule {}