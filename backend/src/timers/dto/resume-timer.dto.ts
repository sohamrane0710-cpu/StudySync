import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ResumeTimerDto {
  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Optional ID of the session to resume for identity verification',
  })
  @IsOptional()
  @IsUUID()
  timerSessionId?: string;
}
