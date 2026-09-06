import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { StageConfigDto } from './create-timer-mode.dto.js';

export class UpdateTimerModeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  loop?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StageConfigDto)
  stagesConfig?: StageConfigDto[];
}
