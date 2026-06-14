import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { EmailLinkingService } from '../core/services/email-linking.service';
import { StreakService } from '../core/services/streak.service';
import { CacheService } from '../core/services/cache.service';
import { UserController } from './user.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [SupabaseAuthGuard, EmailLinkingService, StreakService, CacheService],
})
export class UserModule {}
