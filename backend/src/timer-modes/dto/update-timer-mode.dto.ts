import { PartialType } from '@nestjs/swagger';
import { CreateTimerModeDto } from './create-timer-mode.dto';

export class UpdateTimerModeDto extends PartialType(CreateTimerModeDto) {}
