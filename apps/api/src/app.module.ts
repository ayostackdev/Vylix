import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ClsModule } from 'nestjs-cls';
import { PrismaModule } from './core/prisma/prisma.module';
import { TenantMiddleware } from './core/middlewares/tenant.middleware';
import { RateLimitMiddleware } from './core/middlewares/rate-limit.middleware';
import { ColphysModule } from './colleges/colphys/colphys.module';
import { ColcomModule } from './colleges/colcom/colcom.module';
import { ColengModule } from './colleges/coleng/coleng.module';
import { CoursesModule } from './courses/courses.module';
import { TopicsModule } from './topics/topics.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MaterialsModule } from './materials/materials.module';
import { AuthModule } from './auth/auth.module';
import { SettingsModule } from './settings/settings.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { GamificationModule } from './gamification/gamification.module';
import { QnaModule } from './qna/qna.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true }
    }),
    PrismaModule,
    ColphysModule,
    ColcomModule,
    ColengModule,
    CoursesModule,
    TopicsModule,
    TelemetryModule,
    MaintenanceModule,
    MaterialsModule,
    AuthModule,
    SettingsModule,
    CollaborationModule,
    GamificationModule,
    QnaModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimitMiddleware, TenantMiddleware)
      .forRoutes('*');
  }
}
