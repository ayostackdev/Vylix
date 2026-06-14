/**
 * DTO for creating a new material upload
 * Accepted file formats: PDF, JPG, PNG (max 50MB)
 * File is sent as multipart/form-data with field name 'file'
 */
export class CreateMaterialDto {
  title!: string;
  courseCode?: string;
  courseTitle?: string;
  topicTitle?: string;
  departmentCode?: string;
  isPastQuestion?: boolean;
  examYear?: number;
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