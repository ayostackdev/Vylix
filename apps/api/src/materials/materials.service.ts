import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { CacheService } from '../core/services/cache.service';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import { CreateMaterialDto, MaterialUploadResponseDto } from './materials.dto';
import { MaterialsQueueService } from './materials.queue';
import { STORAGE_PROVIDER_TOKEN, StorageProvider } from '../core/storage/storage-provider.interface';

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly telemetryGateway: TelemetryGateway,
    private readonly materialsQueueService: MaterialsQueueService,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storageProvider: StorageProvider
  ) {}

  async createMaterial(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    dto: CreateMaterialDto,
    uploaderId?: string
  ): Promise<MaterialUploadResponseDto> {
    const hierarchy = await this.ensureColphyHierarchy(dto, uploaderId);
    const storedFile = await this.storageProvider.upload(file);

    const material = await this.prisma.material.create({
      data: {
        fileName: storedFile.fileName,
        fileUrl: storedFile.fileUrl,
        fileSize: file.size,
        topicId: hierarchy.topic.id,
        uploaderId: hierarchy.topic.authorId,
        processingStatus: 'QUEUED',
        isPastQuestion: dto.isPastQuestion ?? false,
        examYear: dto.examYear ?? null,
        semester: dto.semester ?? null,
      }
    });

    let jobId: string | null = null;

    try {
      // First enqueue a virus-scan job which will enqueue the processing job on success.
      const scanJob = await this.materialsQueueService.enqueueVirusScan({ materialId: material.id });
      jobId = scanJob.id ?? null;

      await this.prisma.material.update({
        where: { id: material.id },
        data: {
          processingJobId: jobId,
          processingStatus: 'QUEUED'
        }
      });
    } catch (error) {
      await this.prisma.material.update({
        where: { id: material.id },
        data: {
          processingStatus: 'FAILED',
          processingError: this.formatErrorMessage(error)
        }
      });

      throw error;
    }

    this.telemetryGateway.emitDepartmentPulse(hierarchy.departmentCode, {
      topicId: hierarchy.topic.id,
      type: 'upload',
      title: dto.title,
      message: `${storedFile.fileName} is now queued for processing.`,
      payload: {
        courseId: hierarchy.course.id,
        departmentId: hierarchy.departmentId,
        departmentCode: hierarchy.departmentCode,
        collegeCode: hierarchy.collegeCode,
        fileName: storedFile.fileName,
        jobId
      }
    });

    this.logger.log(
      JSON.stringify({
        event: 'materials.processing.queued',
        queue: 'materials-processing',
        materialId: material.id,
        jobId,
        uploaderId: hierarchy.topic.authorId,
        departmentCode: hierarchy.departmentCode
      })
    );

    // Invalidate cache for this topic
    this.invalidateMaterialsCache(hierarchy.topic.id);

    return {
      id: material.id,
      title: dto.title,
      fileName: material.fileName,
      fileUrl: material.fileUrl,
      fileSize: material.fileSize,
      departmentCode: hierarchy.departmentCode,
      collegeCode: hierarchy.collegeCode,
      courseId: hierarchy.course.id,
      topicId: material.topicId,
      processingStatus: 'QUEUED',
      jobId,
      message: 'Material upload queued for background processing.',
      uploadedAt: material.uploadedAt
    };
  }

  /**
   * Get materials by topic with caching
   */
  async getMaterialsByTopic(topicId: string, limit = 50) {
    const cacheKey = `materials:topic:${topicId}`;
    
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        return this.prisma.material.findMany({
          where: { topicId },
          take: limit,
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            processingStatus: true,
            summary: true,
            questions: true,
            tips: true,
            processedAt: true,
            uploadedAt: true,
            uploader: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true
              }
            }
          }
        });
      },
      300 // Cache for 5 minutes
    );
  }

  /**
   * Get past questions with filters
   */
  async getPastQuestions(params: {
    courseCode?: string;
    year?: number;
    semester?: string;
    departmentCode?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 50);
    const skip = (page - 1) * limit;

    const where: any = { isPastQuestion: true };

    if (params.courseCode) {
      const course = await this.prisma.course.findUnique({
        where: { code: params.courseCode.toUpperCase() },
        select: { id: true, departmentId: true },
      });
      if (course) {
        where.topic = { courseId: course.id };
      }
    }

    if (params.year) {
      where.examYear = params.year;
    }

    if (params.semester) {
      where.semester = params.semester;
    }

    if (params.departmentCode) {
      const department = await this.prisma.department.findUnique({
        where: { code: params.departmentCode.toUpperCase() },
        select: { id: true },
      });
      if (department) {
        where.uploader = { departmentId: department.id };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.material.findMany({
        where,
        take: limit,
        skip,
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          fileSize: true,
          examYear: true,
          semester: true,
          processingStatus: true,
          summary: true,
          uploadedAt: true,
          topic: {
            select: {
              id: true,
              title: true,
              course: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                },
              },
            },
          },
          uploader: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.material.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Get course details with caching
   */
  async getCourseWithCache(courseCode: string) {
    const cacheKey = `course:${courseCode}`;
    
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        return this.prisma.course.findUnique({
          where: { code: courseCode },
          select: {
            id: true,
            code: true,
            title: true,
            level: true,
            departmentId: true,
            isGeneral: true,
            department: {
              select: {
                id: true,
                code: true,
                name: true
              }
            }
          }
        });
      },
      3600 // Cache for 1 hour
    );
  }

  /**
   * Get all topics in a course with caching
   */
  async getTopicsInCourseWithCache(courseId: string) {
    const cacheKey = `course:topics:${courseId}`;
    
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        return this.prisma.topic.findMany({
          where: { courseId, isActive: true },
          orderBy: { lastActivity: 'desc' },
          select: {
            id: true,
            title: true,
            courseId: true,
            authorId: true,
            isActive: true,
            lastActivity: true,
            author: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true
              }
            }
          }
        });
      },
      600 // Cache for 10 minutes
    );
  }

  /**
   * Get user profile with caching
   */
  async getUserProfileWithCache(userId: string) {
    const cacheKey = `user:profile:${userId}`;
    
    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        return this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            fullName: true,
            matricNumber: true,
            avatarUrl: true,
            departmentId: true,
            collegeId: true,
            currentLevel: true,
            status: true,
            contributionScore: true,
            profile: {
              select: {
                bio: true,
                website: true,
                socialLinks: true,
                profileImageUrl: true,
                viewCount: true
              }
            }
          }
        });
      },
      1800 // Cache for 30 minutes
    );
  }

  /**
   * Invalidate materials cache for a topic when new material is uploaded
   */
  private invalidateMaterialsCache(topicId: string) {
    this.cacheService.invalidate(`materials:topic:${topicId}`).catch((err) => {
      this.logger.error(`Failed to invalidate materials cache: ${err}`);
    });
  }

  private formatErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  private async ensureColphyHierarchy(dto: CreateMaterialDto, uploaderId?: string) {
    const collegeCode = 'COLPHY';
    const departmentCode = dto.departmentCode?.trim().toUpperCase() || collegeCode;
    const courseCode = dto.courseCode?.trim().toUpperCase() || 'COLPHY-VAULT';
    const courseTitle = dto.courseTitle?.trim() || 'Colphy Vault Uploads';
    const topicTitle = dto.topicTitle?.trim() || dto.title;

    const college = await this.prisma.college.upsert({
      where: { code: collegeCode },
      update: {},
      create: {
        code: collegeCode,
        name: 'College of Physics',
        durationYears: 4
      }
    });

    const department = await this.prisma.department.upsert({
      where: { code: departmentCode },
      update: { collegeId: college.id },
      create: {
        code: departmentCode,
        name: 'Department of Physics',
        collegeId: college.id
      }
    });

    const course = await this.prisma.course.upsert({
      where: { code: courseCode },
      update: {
        title: courseTitle,
        departmentId: department.id
      },
      create: {
        code: courseCode,
        title: courseTitle,
        level: 100,
        departmentId: department.id,
        isGeneral: false
      }
    });

    const topic = await this.prisma.topic.create({
      data: {
        title: topicTitle,
        courseId: course.id,
        authorId: uploaderId ?? (await this.getFallbackAuthorId(college.id, department.id))
      },
      select: {
        id: true,
        authorId: true
      }
    });

    return {
      collegeCode: college.code,
      departmentCode: department.code,
      departmentId: department.id,
      course,
      topic
    };
  }

  private async getFallbackAuthorId(collegeId: string, departmentId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const systemEmail = 'colphy.system@vylix.local';

    const existingUserEmail = await this.prisma.userEmail.findUnique({
      where: { email: systemEmail },
      include: { user: true }
    });

    if (existingUserEmail?.user) {
      await this.prisma.user.update({
        where: { id: existingUserEmail.user.id },
        data: {
          currentLevel: '100L',
          status: 'STUDENT',
          collegeId,
          departmentId
        }
      });
      return existingUserEmail.user.id;
    }

    const newUser = await this.prisma.user.create({
      data: {
        fullName: 'COLPHY Vault System',
        matricNumber: 'COLPHY-SYSTEM',
        entryYear: currentYear,
        currentLevel: '100L',
        status: 'STUDENT',
        collegeId,
        departmentId,
        emails: {
          create: {
            email: systemEmail,
            isPrimary: true,
            isVerified: true
          }
        }
      }
    });

    return newUser.id;
  }
}