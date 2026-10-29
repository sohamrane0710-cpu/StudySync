import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ example: 'dark-glass' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ example: 'ring', enum: ['ring', 'digital', 'minimal', 'flip'] })
  @IsOptional()
  @IsString()
  timerFace?: string;

  @ApiPropertyOptional({ example: 'rain' })
  @IsOptional()
  @IsString()
  ambientPreset?: string;

  @ApiPropertyOptional({ example: 0.8, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  soundVolume?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  autoStartBreaks?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  autoStartPomodoros?: boolean;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsUUID()
  defaultTimerModeId?: string;
}
