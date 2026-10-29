import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string) {
    let preferences = await this.prisma.userPreference.findUnique({
      where: { userId },
      include: {
        defaultTimerMode: true,
      },
    });

    if (!preferences) {
      // Auto-create default preferences if missing
      preferences = await this.prisma.userPreference.create({
        data: {
          userId,
          theme: 'dark-glass',
          timerFace: 'ring',
          soundVolume: 0.7,
          soundEnabled: true,
          autoStartBreaks: false,
          autoStartPomodoros: false,
        },
        include: {
          defaultTimerMode: true,
        },
      });
    }

    return preferences;
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    // If setting defaultTimerModeId, ensure the mode exists and is accessible
    if (dto.defaultTimerModeId) {
      const mode = await this.prisma.timerMode.findUnique({
        where: { id: dto.defaultTimerModeId },
      });

      if (!mode) {
        throw new NotFoundException('Specified default timer mode does not exist');
      }

      if (mode.userId !== null && mode.userId !== userId) {
        throw new BadRequestException('Cannot set another user\'s private timer mode as default');
      }
    }

    return this.prisma.userPreference.upsert({
      where: { userId },
      update: {
        ...(dto.theme !== undefined && { theme: dto.theme }),
        ...(dto.timerFace !== undefined && { timerFace: dto.timerFace }),
        ...(dto.ambientPreset !== undefined && { ambientPreset: dto.ambientPreset }),
        ...(dto.soundVolume !== undefined && { soundVolume: dto.soundVolume }),
        ...(dto.soundEnabled !== undefined && { soundEnabled: dto.soundEnabled }),
        ...(dto.autoStartBreaks !== undefined && { autoStartBreaks: dto.autoStartBreaks }),
        ...(dto.autoStartPomodoros !== undefined && { autoStartPomodoros: dto.autoStartPomodoros }),
        ...(dto.defaultTimerModeId !== undefined && { defaultTimerModeId: dto.defaultTimerModeId }),
      },
      create: {
        userId,
        theme: dto.theme || 'dark-glass',
        timerFace: dto.timerFace || 'ring',
        ambientPreset: dto.ambientPreset,
        soundVolume: dto.soundVolume ?? 0.7,
        soundEnabled: dto.soundEnabled ?? true,
        autoStartBreaks: dto.autoStartBreaks ?? false,
        autoStartPomodoros: dto.autoStartPomodoros ?? false,
        defaultTimerModeId: dto.defaultTimerModeId,
      },
      include: {
        defaultTimerMode: true,
      },
    });
  }
}
