import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryMessagesDto {
  @ApiPropertyOptional({ example: '2026-10-29T10:00:00.000Z', description: 'Cursor for pagination (fetch messages created before this timestamp)' })
  @IsOptional()
  @IsDateString()
  before?: string;

  @ApiPropertyOptional({ example: 30, default: 30, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;
}
