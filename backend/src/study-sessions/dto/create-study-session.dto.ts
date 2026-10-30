import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StudySessionStatus, TimerPhase } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateStudySessionDto {
  @ApiPropertyOptional({ example: 'Calculus Problem Set 3' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ example: 'Focus Round 1' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  stepName?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stepIndex?: number;

  @ApiPropertyOptional({ enum: TimerPhase, default: TimerPhase.FOCUS })
  @IsOptional()
  @IsEnum(TimerPhase)
  phase?: TimerPhase = TimerPhase.FOCUS;

  @ApiPropertyOptional({ enum: StudySessionStatus, default: StudySessionStatus.COMPLETED })
  @IsOptional()
  @IsEnum(StudySessionStatus)
  status?: StudySessionStatus = StudySessionStatus.COMPLETED;

  @ApiProperty({ example: 1500, description: 'Target planned duration in seconds' })
  @IsInt()
  @Min(0)
  targetDuration: number;

  @ApiProperty({ example: 1500, description: 'Authoritative actual credited duration in seconds' })
  @IsInt()
  @Min(0)
  actualDuration: number;

  @ApiProperty({ example: '2026-10-29T10:00:00.000Z' })
  @IsDateString()
  startedAt: string;

  @ApiProperty({ example: '2026-10-29T10:25:00.000Z' })
  @IsDateString()
  endedAt: string;

  @ApiPropertyOptional({ example: 'Finished problems 1 through 8' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [String], example: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ type: [String], example: ['b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  labelIds?: string[];

  @ApiPropertyOptional({ example: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33' })
  @IsOptional()
  @IsUUID()
  timerSessionId?: string;

  @ApiPropertyOptional({ example: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44' })
  @IsOptional()
  @IsUUID()
  roomStudySessionId?: string;
}
