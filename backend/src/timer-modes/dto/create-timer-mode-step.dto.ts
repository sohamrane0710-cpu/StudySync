import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimerStepType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTimerModeStepDto {
  @ApiProperty({ example: 'Deep Focus' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ enum: TimerStepType, default: TimerStepType.FOCUS })
  @IsOptional()
  @IsEnum(TimerStepType)
  type?: TimerStepType = TimerStepType.FOCUS;

  @ApiProperty({ example: 1500, description: 'Duration in seconds (min 10s, max 86400s)' })
  @IsInt()
  @Min(10)
  @Max(86400)
  duration: number;

  @ApiPropertyOptional({ example: 0, description: '0-indexed order position in the sequence' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
