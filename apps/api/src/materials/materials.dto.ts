export class CreateMaterialDto {
  title!: string;
  courseCode?: string;
  courseTitle?: string;
  topicTitle?: string;
  departmentCode?: string;
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
  summary!: string;
  questions!: string[];
  tips!: string[];
  uploadedAt!: Date;
}