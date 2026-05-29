import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CacheService } from '../services/cache.service';
import { StreakService } from '../services/streak.service';
import { QnaService } from '../services/qna.service';

@Global()
@Module({
  providers: [PrismaService, CacheService, StreakService, QnaService],
  exports: [PrismaService, CacheService, StreakService, QnaService]
})
export class PrismaModule {}
