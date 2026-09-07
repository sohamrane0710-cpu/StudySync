import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, ArrayMinSize, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class StageConfigDto {
  @IsString()
  categoryId: string;

  @IsInt()
  @Min(1)
  durationSeconds: number;
}

export class CreateTimerModeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  loop: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StageConfigDto)
  stagesConfig: StageConfigDto[];
}
