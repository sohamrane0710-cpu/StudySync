import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateInviteDto {
  @ApiPropertyOptional({ example: 48, description: 'Expiration in hours (null = never expires)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720) // 30 days max
  expiresInHours?: number;

  @ApiPropertyOptional({ example: 10, description: 'Maximum number of redemptions (null = unlimited)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxUses?: number;
}
