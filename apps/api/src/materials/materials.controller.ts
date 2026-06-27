import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { AlumniReadOnlyGuard } from '../core/guards/alumni.guard';
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
  @UseGuards(SupabaseAuthGuard, AlumniReadOnlyGuard)
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

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(SupabaseAuthGuard)
  async delete(
    @Param('id') id: string,
    @Req() req: Request
  ): Promise<void> {
    const authenticatedUserId = (req as Request & { user?: { id?: string } }).user?.id;
    if (!authenticatedUserId) {
      throw new BadRequestException('Authenticated user context is missing.');
    }
    await this.materialsService.deleteMaterial(id, authenticatedUserId);
  }

  @Get('my-materials')
  @UseGuards(SupabaseAuthGuard)
  async listMyMaterials(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const authenticatedUserId = (req as Request & { user?: { id?: string } }).user?.id;
    if (!authenticatedUserId) {
      throw new BadRequestException('Authenticated user context is missing.');
    }
    return this.materialsService.getMyMaterials(authenticatedUserId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('past-questions')
  @UseGuards(SupabaseAuthGuard)
  async listPastQuestions(
    @Query('courseCode') courseCode?: string,
    @Query('year') year?: string,
    @Query('semester') semester?: string,
    @Query('departmentCode') departmentCode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.materialsService.getPastQuestions({
      courseCode,
      year: year ? parseInt(year, 10) : undefined,
      semester,
      departmentCode,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}