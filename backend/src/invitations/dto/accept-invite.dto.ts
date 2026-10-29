import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class AcceptInviteDto {
  @ApiProperty({
    example: 'd5f19062e7a17cf1557088b64e030018f4a30e84b162629e8db801faeb2c5a08',
    description: 'Raw 64-character hex invitation token',
  })
  @IsString()
  @IsNotEmpty()
  @Length(64, 64, { message: 'Invitation token must be a 64-character hexadecimal string' })
  token: string;
}
