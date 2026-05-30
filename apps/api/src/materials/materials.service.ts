import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../core/prisma/prisma.service';
import { CacheService } from '../core/services/cache.service';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import { CreateMaterialDto, MaterialUploadResponseDto } from './materials.dto';
import { MaterialsQueueService } from './materials.queue';

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly telemetryGateway: TelemetryGateway,
    private readonly materialsQueueService: MaterialsQueueService
  ) {}

  async createMaterial(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    dto: CreateMaterialDto,
    uploaderId?: string
  ): Promise<MaterialUploadResponseDto> {
    const hierarchy = await this.ensureColphyHierarchy(dto, uploaderId);
    const storedFile = await this.storeFile(file);

    const material = await this.prisma.material.create({
      data: {
        fileName: storedFile.fileName,
        fileUrl: storedFile.fileUrl,
        fileSize: file.size,
        topicId: hierarchy.topic.id,
        uploaderId: hierarchy.topic.authorId,
        processingStatus: 'QUEUED'
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

  private async storeFile(file: { buffer: Buffer; originalname: string; mimetype: string; size: number }) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const bucket = this.configService.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'material';
    const maxUploadMb = parseInt(this.configService.get<string>('MAX_UPLOAD_MB') ?? '50', 10);

    // Server-side validations
    if (typeof file.size === 'number' && file.size > maxUploadMb * 1024 * 1024) {
      throw new BadRequestException(`File size exceeds maximum allowed size of ${maxUploadMb} MB`);
    }

    const allowedMimePatterns = [
      /^image\//,
      /^application\/pdf$/,
      /^text\//,
      /^application\/msword$/,
      /^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/,
      /^application\/zip$/
    ];

    const mimetype = file.mimetype || '';
    const isAllowed = allowedMimePatterns.some((rx) => rx.test(mimetype));
    if (!isAllowed) {
      throw new BadRequestException('File type is not allowed');
    }

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `colphy/${new Date().getFullYear()}/${randomUUID()}-${safeName}`;
    const uploadUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${objectPath}`;

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'content-type': file.mimetype || 'application/pdf',
        'x-upsert': 'true'
      },
      body: file.buffer as unknown as BodyInit
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Supabase upload failed with status ${response.status}${errorText ? `: ${errorText}` : ''}`);
    }

    // Try to create a signed URL (for private buckets) with a 24h expiry.
    let fileUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${objectPath}`;
    try {
      const signResp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/sign/${bucket}/${objectPath}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ expiresIn: 86400 })
      });

      if (signResp.ok) {
        const data = await signResp.json().catch(() => null) as any;
        fileUrl = data?.signedURL || data?.signedUrl || data?.signed_url || fileUrl;
      } else {
        this.logger.warn(`Failed to create signed URL: ${signResp.status}`);
      }
    } catch (err) {
      this.logger.warn(`Signed URL creation failed: ${err}`);
    }

    return {
      fileName: file.originalname,
      filePath: objectPath,
      fileUrl
    };
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
    const systemEmail = 'colphy.system@campulse.local';

    const existingUserEmail = await this.prisma.userEmail.findUnique({
      where: { email: systemEmail },
      include: { user: true }
    });

    if (existingUserEmail?.user) {
      await this.prisma.user.update({
        where: { id: existingUserEmail.user.id },
        data: {
          currentLevel: '100L',
          expectedGraduationYear: currentYear + 4,
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
        expectedGraduationYear: currentYear + 4,
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