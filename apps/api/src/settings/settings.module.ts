import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { SettingsController } from './settings.controller';
import { BadgeService } from '../core/services/badge.service';
import { PrivacyService } from '../core/services/privacy.service';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [BadgeService, PrivacyService, SupabaseAuthGuard],
  exports: [BadgeService, PrivacyService],
})
export class SettingsModule {}
