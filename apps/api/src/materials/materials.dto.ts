import { IsString, IsOptional, IsBoolean, IsNumber, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateMaterialDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  courseCode?: string;

  @IsOptional()
  @IsString()
  courseTitle?: string;

  @IsOptional()
  @IsString()
  topicTitle?: string;

  @IsOptional()
  @IsString()
  departmentCode?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isPastQuestion?: boolean;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  examYear?: number;

  @IsOptional()
  @IsString()
  semester?: string;
}

export class PastQuestionsQueryDto {
  courseCode?: string;
  year?: number;
  semester?: string;
  departmentCode?: string;
  page?: number;
  limit?: number;
}

export class MaterialUploadResponseDto {
  id!: string;
  title!: string;
  fileName!: string;
  fileUrl!: string;
  fileSize!: number;
  departmentCode!: string;
  collegeCode!: string;
  courseId!: string;
  topicId!: string;
  processingStatus!: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  jobId!: string | null;
  message!: string;
  uploadedAt!: Date;
  shareUrl?: string; // URL for sharing to WhatsApp/social
}