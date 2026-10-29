import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'Hey everyone, starting a 50m deep work sprint on algorithms!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
