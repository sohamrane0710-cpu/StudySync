import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class FinishSequenceDto {
  @ApiPropertyOptional({
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    description: 'Mandatory ID of active TimerSession if a timer is active when terminating sequence',
  })
  @IsOptional()
  @IsUUID()
  timerSessionId?: string;
}
