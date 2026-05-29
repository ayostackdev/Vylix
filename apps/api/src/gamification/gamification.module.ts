import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { GamificationController } from './gamification.controller';

@Module({
  imports: [PrismaModule],
  controllers: [GamificationController]
})
export class GamificationModule {}
