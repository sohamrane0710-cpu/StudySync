import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CancelTimerDto {
  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Optional ID of the session to cancel for identity verification',
  })
  @IsOptional()
  @IsUUID()
  timerSessionId?: string;

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

