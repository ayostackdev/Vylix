import { BadRequestException, Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateMaterialDto, MaterialUploadResponseDto } from './materials.dto';
import { MaterialsService } from './materials.service';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  create(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @Body() dto: CreateMaterialDto
  ): Promise<MaterialUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('A PDF file is required.');
    }

    return this.materialsService.createMaterial(file, dto);
  }
}