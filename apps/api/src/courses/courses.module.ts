import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { CacheService } from '../core/services/cache.service';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  imports: [PrismaModule],
  controllers: [CoursesController],
  providers: [CoursesService, CacheService],
})
export class CoursesModule {}
