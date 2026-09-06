import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateTimerSessionDto {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  timerModeId: string;
}
