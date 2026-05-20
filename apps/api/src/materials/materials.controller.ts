import { BadRequestException, Body, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { SupabaseAuthGuard } from '../core/guards/auth.guard';
import { CreateMaterialDto, MaterialUploadResponseDto } from './materials.dto';
import { MaterialsService } from './materials.service';

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
      throw new BadRequestException('A PDF file is required.');
    }

    const authenticatedUserId = (req as Request & { user?: { id?: string } }).user?.id;

    if (!authenticatedUserId) {
      throw new BadRequestException('Authenticated user context is missing.');
    }

    return this.materialsService.createMaterial(file, dto, authenticatedUserId);
  }
}