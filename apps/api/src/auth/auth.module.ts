import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { AlumniService } from './alumni.service';
import { AuthController } from './auth.controller';
import { EmailLinkingService } from '../core/services/email-linking.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AlumniService, EmailLinkingService, SupabaseAuthGuard],
  exports: [AlumniService, EmailLinkingService, SupabaseAuthGuard],
})
export class AuthModule {}
