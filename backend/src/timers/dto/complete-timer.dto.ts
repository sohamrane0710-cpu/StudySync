import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CompleteTimerDto {
  @ApiProperty({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Mandatory ID of the specific TimerSession to complete',
  })
  @IsNotEmpty()
  @IsUUID()
  timerSessionId: string;

  @ApiPropertyOptional({ example: 'Operating Systems Revision' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ example: 'Covered process synchronization and semaphores' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  labelIds?: string[];

  @ApiPropertyOptional({ example: true, description: 'Whether to automatically transition to break phase' })
  @IsOptional()
  @IsBoolean()
  advanceToNextPhase?: boolean;
}
