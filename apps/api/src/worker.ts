import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MaterialsWorkerModule } from './materials/materials.worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(MaterialsWorkerModule, {
    logger: ['log', 'warn', 'error', 'debug', 'verbose']
  });

  app.enableShutdownHooks();

  const logger = new Logger('WorkerBootstrap');
  logger.log('Materials worker started');
}

void bootstrap();