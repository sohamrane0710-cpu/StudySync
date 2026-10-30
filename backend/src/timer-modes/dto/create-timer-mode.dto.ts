import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimerDirection } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateTimerModeStepDto } from './create-timer-mode-step.dto';

export class CreateTimerModeDto {
  @ApiProperty({ example: 'Deep Focus Sequence' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ example: 'Custom alternating sequence for intense study' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Whether sequence loops continuously upon reaching the final step' })
  @IsOptional()
  @IsBoolean()
  isLooping?: boolean = true;

  @ApiPropertyOptional({ enum: TimerDirection, default: TimerDirection.COUNTDOWN })
  @IsOptional()
  @IsEnum(TimerDirection)
  defaultDirection?: TimerDirection = TimerDirection.COUNTDOWN;

  @ApiPropertyOptional({
    type: [CreateTimerModeStepDto],
    description: 'Ordered list of timer sequence steps',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTimerModeStepDto)
  steps?: CreateTimerModeStepDto[];

  // Legacy fallback fields (preserved for zero disruption with existing clients and tests)
  @ApiPropertyOptional({ example: 1500, description: 'Legacy focus duration in seconds' })
  @IsOptional()
  @IsInt()
  @Min(10)
  focusDuration?: number;

  @ApiPropertyOptional({ example: 300, description: 'Legacy short break duration in seconds' })
  @IsOptional()
  @IsInt()
  @Min(10)
  shortBreakDuration?: number;

  @ApiPropertyOptional({ example: 900, description: 'Legacy long break duration in seconds' })
  @IsOptional()
  @IsInt()
  @Min(10)
  longBreakDuration?: number;

  @ApiPropertyOptional({ example: 4, description: 'Legacy cycles before long break' })
  @IsOptional()
  @IsInt()
  @Min(1)
  longBreakInterval?: number;
}
