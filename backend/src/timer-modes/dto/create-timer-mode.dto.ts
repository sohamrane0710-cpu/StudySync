import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTimerModeDto {
  @ApiProperty({ example: 'Deep Focus 50/10' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ example: 'Extended 50m focus with 10m short breaks' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ example: 3000, description: 'Focus duration in seconds (e.g. 50 minutes = 3000s)' })
  @IsInt()
  @Min(60)
  focusDuration: number;

  @ApiProperty({ example: 600, description: 'Short break duration in seconds (e.g. 10 minutes = 600s)' })
  @IsInt()
  @Min(60)
  shortBreakDuration: number;

  @ApiProperty({ example: 1800, description: 'Long break duration in seconds (e.g. 30 minutes = 1800s)' })
  @IsInt()
  @Min(60)
  longBreakDuration: number;

  @ApiPropertyOptional({ example: 4, description: 'Cycles before long break' })
  @IsOptional()
  @IsInt()
  @Min(1)
  longBreakInterval?: number = 4;
}
