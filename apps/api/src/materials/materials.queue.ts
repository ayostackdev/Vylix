import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { createRedisConnectionOptions } from '../core/queues/redis-connection';

export const MATERIALS_PROCESSING_QUEUE = 'materials-processing';
export const MATERIALS_PROCESSING_JOB = 'process-material';

export type MaterialProcessingJobPayload = {
  materialId: string;
};

@Injectable()
export class MaterialsQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(MaterialsQueueService.name);
  private readonly queue: Queue<MaterialProcessingJobPayload>;

  constructor(private readonly configService: ConfigService) {
    this.queue = new Queue<MaterialProcessingJobPayload>(MATERIALS_PROCESSING_QUEUE, {
      connection: createRedisConnectionOptions(this.configService)
    });
  }

  enqueueMaterialProcessing(payload: MaterialProcessingJobPayload): Promise<Job<MaterialProcessingJobPayload>> {
    return this.queue.add(MATERIALS_PROCESSING_JOB, payload, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5_000
      },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
      jobId: payload.materialId
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
    this.logger.log(`Closed queue ${MATERIALS_PROCESSING_QUEUE}`);
  }
}