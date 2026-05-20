import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { AlumniService } from './alumni.service';
import { AuthController } from './auth.controller';
import { EmailLinkingService } from '../core/services/email-linking.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AlumniService, EmailLinkingService],
  exports: [AlumniService, EmailLinkingService],
})
export class AuthModule {}
