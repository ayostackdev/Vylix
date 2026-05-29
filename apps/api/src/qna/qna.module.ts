import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module';
import { QnaController } from './qna.controller';

@Module({
  imports: [PrismaModule],
  controllers: [QnaController]
})
export class QnaModule {}
