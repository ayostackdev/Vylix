import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../core/prisma/prisma.service';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async pruneOldMaterials() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);

    const candidates = await this.prisma.material.findMany({
      where: { uploadedAt: { lt: cutoff } },
      select: { id: true, fileUrl: true }
    });

    if (!candidates.length) {
      this.logger.log('No stale materials to prune.');
      return;
    }

    // TODO: Add distributed lock + Cloudinary deletion before DB delete in production.
    await this.prisma.material.deleteMany({
      where: {
        id: {
          in: candidates.map((item: { id: string }) => item.id)
        }
      }
    });

    this.logger.log(`Pruned ${candidates.length} stale materials.`);
  }
}
