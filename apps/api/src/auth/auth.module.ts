import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { AuthController } from './auth.controller';
import { EmailLinkingService } from '../core/services/email-linking.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [EmailLinkingService, SupabaseAuthGuard],
  exports: [EmailLinkingService, SupabaseAuthGuard],
})
export class AuthModule {}
