import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  matricNumber?: string;

  @IsOptional()
  @IsNumber()
  entryYear?: number;

  @IsOptional()
  @IsString()
  collegeId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  currentLevel?: string;
}
