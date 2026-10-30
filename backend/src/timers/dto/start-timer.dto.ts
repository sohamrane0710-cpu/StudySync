import { ApiPropertyOptional } from '@nestjs/swagger';
import { TimerDirection, TimerPhase } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class StartTimerDto {
  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  timerModeId?: string;

  @ApiPropertyOptional({ example: 0, description: 'Optional 0-indexed step in sequence to start from' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stepIndex?: number;

  @ApiPropertyOptional({ enum: TimerDirection, description: 'Per-run direction override' })
  @IsOptional()
  @IsEnum(TimerDirection)
  directionOverride?: TimerDirection;

  @ApiPropertyOptional({ enum: TimerPhase })
  @IsOptional()
  @IsEnum(TimerPhase)
  phase?: TimerPhase;

  @ApiPropertyOptional({ example: 1500, description: 'Optional custom duration override in seconds (10s to 86400s)' })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(86400)
  durationOverride?: number;
}

