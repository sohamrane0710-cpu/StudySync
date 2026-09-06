import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, ArrayMinSize, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum StageType {
  FOCUS = 'FOCUS',
  SHORT_BREAK = 'SHORT_BREAK',
  LONG_BREAK = 'LONG_BREAK',
}

export class StageConfigDto {
  @IsEnum(StageType)
  type: StageType;

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
