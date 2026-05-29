import { BadRequestException, Body, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { CreateMaterialDto, MaterialUploadResponseDto } from './materials.dto';
import { MaterialsService } from './materials.service';

// Accepted MIME types for material uploads
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg'
];

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post('upload')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  create(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body() dto: CreateMaterialDto,
    @Req() req: Request
  ): Promise<MaterialUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('A file is required. Accepted formats: PDF, JPG, PNG');
    }

    // Validate file type
    if (!ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file format. Accepted formats: PDF, JPG, PNG. Received: ${file.mimetype}`
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    const authenticatedUserId = (req as Request & { user?: { id?: string } }).user?.id;

    if (!authenticatedUserId) {
      throw new BadRequestException('Authenticated user context is missing.');
    }

    return this.materialsService.createMaterial(file, dto, authenticatedUserId);
  }
}