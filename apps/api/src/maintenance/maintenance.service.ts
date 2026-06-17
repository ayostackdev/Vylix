import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../core/prisma/prisma.service';
import * as crypto from 'node:crypto';

export interface CourseSeedStatus {
  courseCode: string;
  courseTitle: string;
  departmentCode: string;
  collegeCode: string;
  seedCount: number;
  organicCount: number;
  sufficient: boolean;
}

export interface PurgeReadinessReport {
  totalSeedMaterials: number;
  totalOrganicMaterials: number;
  courses: CourseSeedStatus[];
  coursesWithLowOrganic: number;
  totalCourses: number;
  ready: boolean;
  message: string;
}

export interface PurgeResult {
  deletedCount: number;
  readiness: PurgeReadinessReport;
}

export interface NonceResult {
  nonce: string;
  expiresInSeconds: number;
  readiness: PurgeReadinessReport;
}

const MIN_ORGANIC_PER_COURSE = 5;
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PURGE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);
  private readonly nonces = new Map<string, number>();
  private lastPurgeAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async pruneOldMaterials() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);

    const candidates = await this.prisma.material.findMany({
      where: {
        uploadedAt: { lt: cutoff },
        isSeed: false,
      },
      select: { id: true, fileUrl: true }
    });

    if (!candidates.length) {
      this.logger.log('No stale materials to prune.');
      return;
    }

    await this.prisma.material.deleteMany({
      where: {
        id: {
          in: candidates.map((item: { id: string }) => item.id)
        }
      }
    });

    this.logger.log(`Pruned ${candidates.length} stale organic materials.`);
  }

  // ── Readiness check ──────────────────────────────────────────

  async checkPurgeReadiness(): Promise<PurgeReadinessReport> {
    const [totalSeedMaterials, totalOrganicMaterials, courses] = await Promise.all([
      this.prisma.material.count({ where: { isSeed: true } }),
      this.prisma.material.count({ where: { isSeed: false } }),
      this.prisma.course.findMany({
        select: {
          code: true,
          title: true,
          department: {
            select: {
              code: true,
              college: { select: { code: true } },
            },
          },
          topics: {
            select: {
              materials: {
                select: { isSeed: true },
              },
            },
          },
        },
      }),
    ]);

    let coursesWithLowOrganic = 0;

    const courseStatuses: CourseSeedStatus[] = courses
      .filter((c) => c.department !== null)
      .map((c) => {
        const dept = c.department!;
        let seedCount = 0;
        let organicCount = 0;

        for (const topic of c.topics) {
          for (const material of topic.materials) {
            if (material.isSeed) seedCount++;
            else organicCount++;
          }
        }

        const sufficient = organicCount >= MIN_ORGANIC_PER_COURSE;
        if (!sufficient && organicCount > 0) coursesWithLowOrganic++;

        return {
          courseCode: c.code,
          courseTitle: c.title,
          departmentCode: dept.code,
          collegeCode: dept.college.code,
          seedCount,
          organicCount,
          sufficient,
        };
      });

    const lowOrganicCourses = courseStatuses.filter(
      (c) => !c.sufficient && c.seedCount > 0,
    );

    const ready = lowOrganicCourses.length === 0;

    let message: string;
    if (totalSeedMaterials === 0) {
      message = 'No seed materials exist. Nothing to purge.';
    } else if (ready) {
      message = `All ${courses.length} courses have at least ${MIN_ORGANIC_PER_COURSE} organic materials. Ready to purge.`;
    } else {
      message = `${lowOrganicCourses.length} course(s) still rely on seed materials (fewer than ${MIN_ORGANIC_PER_COURSE} organic uploads each). Purge not recommended yet.`;
    }

    return {
      totalSeedMaterials,
      totalOrganicMaterials,
      courses: courseStatuses,
      coursesWithLowOrganic,
      totalCourses: courses.length,
      ready,
      message,
    };
  }

  // ── Nonce generation ────────────────────────────────────────

  async generateNonce(): Promise<NonceResult> {
    this.evictExpiredNonces();

    const cooldownRemaining = PURGE_COOLDOWN_MS - (Date.now() - this.lastPurgeAt);
    if (cooldownRemaining > 0) {
      const minutes = Math.ceil(cooldownRemaining / 60000);
      throw new Error(`Purge was already performed within the last hour. Try again in ${minutes} minute(s).`);
    }

    const nonce = crypto.randomBytes(32).toString('hex');
    this.nonces.set(nonce, Date.now());

    const readiness = await this.checkPurgeReadiness();
    return { nonce, expiresInSeconds: NONCE_TTL_MS / 1000, readiness };
  }

  // ── Nonce-verified purge ────────────────────────────────────

  async purgeWithNonce(nonce: string): Promise<PurgeResult> {
    this.evictExpiredNonces();

    const createdAt = this.nonces.get(nonce);
    if (!createdAt) {
      throw new Error('Invalid or expired nonce. Call POST /maintenance/purge-seed-data/confirm first.');
    }

    this.nonces.delete(nonce);

    const readiness = await this.checkPurgeReadiness();
    if (readiness.totalSeedMaterials === 0) {
      return { deletedCount: 0, readiness };
    }

    if (!readiness.ready) {
      return { deletedCount: 0, readiness };
    }

    return this.executePurge(readiness);
  }

  // ── Internal: batch delete ──────────────────────────────────

  private async executePurge(readiness: PurgeReadinessReport): Promise<PurgeResult> {
    const BATCH_SIZE = 500;
    let totalDeleted = 0;

    while (true) {
      const batch = await this.prisma.material.findMany({
        where: { isSeed: true },
        take: BATCH_SIZE,
        select: { id: true },
      });

      if (batch.length === 0) break;

      await this.prisma.material.deleteMany({
        where: { id: { in: batch.map((m) => m.id) } },
      });

      totalDeleted += batch.length;
      this.logger.log(`Purge batch: deleted ${totalDeleted} seed materials.`);
    }

    const orphanedTopics = await this.prisma.topic.deleteMany({
      where: {
        materials: { none: {} },
        author: { emails: { some: { email: 'vault.system@vylix.local' } } },
      },
    });

    if (orphanedTopics.count > 0) {
      this.logger.log(`Cleaned up ${orphanedTopics.count} orphaned seed topics.`);
    }

    this.lastPurgeAt = Date.now();
    this.logger.log(`Seed data purge complete: ${totalDeleted} materials removed.`);
    return { deletedCount: totalDeleted, readiness };
  }

  // ── Helpers ─────────────────────────────────────────────────

  private evictExpiredNonces() {
    const cutoff = Date.now() - NONCE_TTL_MS;
    for (const [nonce, createdAt] of this.nonces) {
      if (createdAt < cutoff) {
        this.nonces.delete(nonce);
      }
    }
  }
}
