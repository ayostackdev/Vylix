import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { createRedisConnectionOptions } from '../core/queues/redis-connection';
import { MATERIALS_PROCESSING_QUEUE, MaterialProcessingJobPayload } from '../materials/materials.queue';

export type MaterialsQueueStats = {
  queue: string;
  counts: Record<string, number>;
  failedJobs: Array<{
    id: string | number | undefined;
    materialId: string;
    attemptsMade: number;
    failedReason?: string;
    finishedOn?: number | null;
  }>;
};

@Injectable()
export class MaterialsQueueAdminService {
  private readonly queue: Queue<MaterialProcessingJobPayload>;

  constructor(private readonly configService: ConfigService) {
    this.queue = new Queue<MaterialProcessingJobPayload>(MATERIALS_PROCESSING_QUEUE, {
      connection: createRedisConnectionOptions(this.configService)
    });
  }

  async getStats(limit = 20): Promise<MaterialsQueueStats> {
    const counts = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
    const failedJobs = await this.queue.getFailed(0, Math.max(0, limit - 1));

    return {
      queue: MATERIALS_PROCESSING_QUEUE,
      counts,
      failedJobs: failedJobs.map((job) => ({
        id: job.id,
        materialId: job.data.materialId,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason ?? undefined,
        finishedOn: job.finishedOn ?? null
      }))
    };
  }

  async retryFailedJob(jobId: string): Promise<{ jobId: string; materialId: string }> {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} was not found.`);
    }

    const state = await job.getState();
    if (state !== 'failed') {
      throw new Error(`Job ${jobId} is not in a failed state.`);
    }

    await job.retry();

    return {
      jobId: job.id ?? jobId,
      materialId: job.data.materialId
    };
  }

  async close() {
    await this.queue.close();
  }
}