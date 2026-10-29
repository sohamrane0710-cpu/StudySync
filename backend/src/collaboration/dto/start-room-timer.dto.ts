import { ApiPropertyOptional } from '@nestjs/swagger';
import { TimerPhase } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class StartRoomTimerDto {
  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  timerModeId?: string;

  @ApiPropertyOptional({ enum: TimerPhase, default: TimerPhase.FOCUS })
  @IsOptional()
  @IsEnum(TimerPhase)
  phase?: TimerPhase = TimerPhase.FOCUS;

  @ApiPropertyOptional({ example: 1800, description: 'Duration override in seconds' })
  @IsOptional()
  @IsInt()
  @Min(60)
  durationOverride?: number;
}
