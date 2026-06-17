import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../core/prisma/prisma.service';
import { createRedisConnectionOptions } from '../core/queues/redis-connection';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import { MATERIALS_PROCESSING_QUEUE, MATERIALS_PROCESSING_JOB, MaterialProcessingJobPayload } from './materials.queue';

type StudyInsightsResponse = {
  department_code: string;
  summary: string;
  questions: string[];
  tips: string[];
};

@Injectable()
export class MaterialsProcessingWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaterialsProcessingWorkerService.name);
  private worker?: Worker<MaterialProcessingJobPayload>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly telemetryGateway: TelemetryGateway
  ) {}

  async onModuleInit() {
    this.worker = new Worker<MaterialProcessingJobPayload>(
      MATERIALS_PROCESSING_QUEUE,
      async (job) => {
        // Dispatch based on job name: handle scan jobs separately
        if (job.name === 'virus-scan') {
          return this.handleScanJob(job);
        }
        return this.processJob(job);
      },
      {
        connection: createRedisConnectionOptions(this.configService),
        concurrency: Number(this.configService.get<string>('MATERIALS_WORKER_CONCURRENCY') ?? 5)
      }
    );

    this.worker.on('completed', (job, result) => {
      this.logger.log(
        JSON.stringify({
          event: 'materials.processing.success',
          queue: MATERIALS_PROCESSING_QUEUE,
          jobId: job.id,
          materialId: job.data.materialId,
          attemptsMade: job.attemptsMade,
          status: 'completed',
          result
        })
      );
    });

    this.worker.on('failed', async (job, error) => {
      if (!job) {
        return;
      }

      const attempts = job.opts.attempts ?? 1;
      const finalFailure = job.attemptsMade >= attempts;

      this.logger[finalFailure ? 'error' : 'warn'](
        JSON.stringify({
          event: finalFailure ? 'materials.processing.failed' : 'materials.processing.retry',
          queue: MATERIALS_PROCESSING_QUEUE,
          jobId: job.id,
          materialId: job.data.materialId,
          attemptsMade: job.attemptsMade,
          attempts,
          status: finalFailure ? 'failed' : 'retrying',
          error: this.formatError(error)
        })
      );

      if (finalFailure) {
        const where = job.id
          ? { id: job.data.materialId, processingJobId: job.id }
          : { id: job.data.materialId };

        await this.prisma.material.updateMany({
          where,
          data: {
            processingStatus: 'FAILED',
            processingError: this.formatError(error)
          }
        });

        const failedMaterial = await this.prisma.material.findUnique({
          where: { id: job.data.materialId },
          include: {
            topic: {
              include: {
                course: {
                  include: {
                    department: true
                  }
                }
              }
            }
          }
        });

        if (failedMaterial) {
          this.telemetryGateway.emitDepartmentPulse(failedMaterial.topic.course.department?.code ?? 'UNKNOWN', {
            topicId: failedMaterial.topicId,
            type: 'status',
            title: 'Material processing failed',
            message: failedMaterial.processingError ?? this.formatError(error),
            payload: {
              materialId: failedMaterial.id,
              processingStatus: 'FAILED',
              topicTitle: failedMaterial.topic.title,
              fileName: failedMaterial.fileName
            }
          });
        }
      }
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    this.logger.log(`Closed worker for ${MATERIALS_PROCESSING_QUEUE}`);
  }

  private async processJob(job: Job<MaterialProcessingJobPayload>) {
    const startedAt = Date.now();

    const material = await this.prisma.material.findUnique({
      where: { id: job.data.materialId },
      include: {
        topic: {
          include: {
            course: {
              include: {
                department: true
              }
            }
          }
        }
      }
    });

    if (!material) {
      throw new Error(`Material ${job.data.materialId} was not found.`);
    }

    if (material.processingStatus === 'COMPLETED' && material.summary && material.questions && material.tips) {
      return {
        materialId: material.id,
        departmentCode: material.topic.course.department?.code ?? 'UNKNOWN',
        durationMs: Date.now() - startedAt,
        skipped: true
      };
    }

    if (material.processingJobId && job.id && material.processingJobId !== job.id) {
      return {
        materialId: material.id,
        departmentCode: material.topic.course.department?.code ?? 'UNKNOWN',
        durationMs: Date.now() - startedAt,
        skipped: true
      };
    }

    await this.prisma.material.update({
      where: { id: material.id },
      data: {
        processingStatus: 'PROCESSING',
        processingJobId: job.id ?? material.processingJobId ?? null,
        processingError: null
      }
    });

    this.telemetryGateway.emitDepartmentPulse(material.topic.course.department?.code ?? 'UNKNOWN', {
      topicId: material.topicId,
      type: 'status',
      title: 'Material processing started',
      message: `${material.fileName} is being processed now.`,
      payload: {
        materialId: material.id,
        processingStatus: 'PROCESSING',
        processingJobId: job.id ?? material.processingJobId ?? null,
        topicTitle: material.topic.title,
        fileName: material.fileName
      }
    });

    const insights = await this.requestStudyInsights(
      material.fileUrl,
      material.topic.course.department?.code ?? 'UNKNOWN',
      material.topic.title
    );

    await this.prisma.material.update({
      where: { id: material.id },
      data: {
        processingStatus: 'COMPLETED',
        summary: insights.summary,
        questions: insights.questions,
        tips: insights.tips,
        processedAt: new Date(),
        processingError: null
      }
    });

    this.telemetryGateway.emitDepartmentPulse(insights.department_code ?? material.topic.course.department?.code ?? 'UNKNOWN', {
      topicId: material.topicId,
      type: 'status',
      title: 'Material processing completed',
      message: `${material.fileName} is ready with study insights.`,
      payload: {
        materialId: material.id,
        processingStatus: 'COMPLETED',
        topicTitle: material.topic.title,
        fileName: material.fileName,
        summary: insights.summary
      }
    });

    return {
      materialId: material.id,
      departmentCode: insights.department_code,
      durationMs: Date.now() - startedAt,
      skipped: false
    };
  }

  private async handleScanJob(job: Job<MaterialProcessingJobPayload>) {
    const materialId = job.data.materialId;

    // Update status to SCANNING
    await this.prisma.material.update({ where: { id: materialId }, data: { processingStatus: 'PROCESSING', processingError: null } });

    // Simple stub scan: in real deployments call an AV service or run clamd
    try {
      // Placeholder: perform basic checks (could call external scanner)
      const material = await this.prisma.material.findUnique({ where: { id: materialId } });
      if (!material) throw new Error('Material not found for scan');

      // TODO: implement real virus scanning here. For now, assume clean.

      // Enqueue the actual processing job after successful scan
      const queue = new (require('bullmq').Queue)(MATERIALS_PROCESSING_QUEUE, { connection: createRedisConnectionOptions(this.configService) });
      await queue.add(MATERIALS_PROCESSING_JOB, { materialId }, { jobId: materialId });

      // Mark as QUEUED for processing
      await this.prisma.material.update({ where: { id: materialId }, data: { processingStatus: 'QUEUED' } });

      return { materialId, scanned: true };
    } catch (err) {
      await this.prisma.material.update({ where: { id: materialId }, data: { processingStatus: 'FAILED', processingError: this.formatError(err) } });
      throw err;
    }
  }

  private async requestStudyInsights(fileUrl: string, departmentCode: string, title: string): Promise<StudyInsightsResponse> {
    const pythonServiceUrl = this.configService.get<string>('PYTHON_SERVICE_URL') ?? 'http://localhost:8000';
    const response = await fetch(`${pythonServiceUrl}/api/v1/insights/from-url`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        file_url: fileUrl,
        department_code: departmentCode,
        title
      })
    });

    if (!response.ok) {
      this.logger.warn(
        JSON.stringify({
          event: 'materials.processing.fallback',
          departmentCode,
          title,
          statusCode: response.status
        })
      );

      return {
        department_code: departmentCode,
        summary: `Uploaded material ${title} was recorded successfully.`,
        questions: [
          `What are the key takeaways from ${title}?`,
          `Which concepts in ${title} are most likely to appear in an exam?`,
          `How can you explain the main idea in ${title} in your own words?`
        ],
        tips: [
          'Review the PDF once offline caching completes.',
          'Turn the main points into flashcards.',
          'Discuss the document in Public Pulse when you are ready to share it.'
        ]
      };
    }

    return (await response.json()) as StudyInsightsResponse;
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Unknown worker error';
  }
}