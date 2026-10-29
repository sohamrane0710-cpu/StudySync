import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelTimerDto {
  @ApiPropertyOptional({ example: 'Interrupted by team meeting' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;

  @ApiPropertyOptional({ example: true, description: 'Save partial study session if elapsed time exceeds minimum threshold' })
  @IsOptional()
  @IsBoolean()
  savePartialRecord?: boolean = true;
}
