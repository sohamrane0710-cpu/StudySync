import { PartialType } from '@nestjs/swagger';
import { CreateTimerModeStepDto } from './create-timer-mode-step.dto';

export class UpdateTimerModeStepDto extends PartialType(CreateTimerModeStepDto) {}
