import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../core/prisma/prisma.service';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import { CreateMaterialDto, MaterialUploadResponseDto } from './materials.dto';

type StudyInsightsResponse = {
  department_code: string;
  summary: string;
  questions: string[];
  tips: string[];
};

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly telemetryGateway: TelemetryGateway
  ) {}

  async createMaterial(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    dto: CreateMaterialDto
  ): Promise<MaterialUploadResponseDto> {
    const hierarchy = await this.ensureColphyHierarchy(dto);
    const storedFile = await this.storeFile(file);
    const insights = await this.requestStudyInsights(storedFile.fileUrl, hierarchy.departmentCode, dto.title);

    const material = await this.prisma.material.create({
      data: {
        fileName: storedFile.fileName,
        fileUrl: storedFile.fileUrl,
        fileSize: file.size,
        topicId: hierarchy.topic.id,
        uploaderId: hierarchy.topic.authorId
      }
    });

    this.telemetryGateway.emitDepartmentPulse(hierarchy.departmentId, {
      topicId: hierarchy.topic.id,
      type: 'upload'
    });

    return {
      id: material.id,
      title: dto.title,
      fileName: material.fileName,
      fileUrl: material.fileUrl,
      fileSize: material.fileSize,
      departmentCode: insights.department_code,
      collegeCode: hierarchy.collegeCode,
      courseId: hierarchy.course.id,
      topicId: material.topicId,
      summary: insights.summary,
      questions: insights.questions,
      tips: insights.tips,
      uploadedAt: material.uploadedAt
    };
  }

  private async storeFile(file: { buffer: Buffer; originalname: string; mimetype: string; size: number }) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const bucket = this.configService.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'materials';

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
      body: new Blob([file.buffer], { type: file.mimetype || 'application/pdf' })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Supabase upload failed with status ${response.status}${errorText ? `: ${errorText}` : ''}`);
    }

    return {
      fileName: file.originalname,
      filePath: objectPath,
      fileUrl: `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${objectPath}`
    };
  }

  private async ensureColphyHierarchy(dto: CreateMaterialDto) {
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
        authorId: await this.getFallbackAuthorId(college.id, department.id)
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
    
    // Check if user with this email exists
    const existingUserEmail = await this.prisma.userEmail.findUnique({
      where: { email: systemEmail },
      include: { user: true }
    });

    if (existingUserEmail?.user) {
      // Update existing user
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

    // Create new system user
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
      this.logger.warn(`Python support service unavailable, falling back to local insights. Status: ${response.status}`);
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
}