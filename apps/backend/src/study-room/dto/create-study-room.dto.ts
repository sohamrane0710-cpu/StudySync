import { IsString, IsNotEmpty, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { RoomVisibility } from '@prisma/client';

export class CreateStudyRoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(RoomVisibility)
  @IsOptional()
  visibility?: RoomVisibility;
}
