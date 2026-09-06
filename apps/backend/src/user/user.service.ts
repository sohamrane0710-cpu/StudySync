import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async checkUsernameAvailability(username: string): Promise<boolean> {
    if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      throw new BadRequestException('Invalid username format');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { username },
    });

    return !existingUser;
  }

  async completeOnboarding(userId: string, dto: CompleteOnboardingDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.onboardingCompleted) {
      throw new ConflictException('Onboarding has already been completed');
    }

    const isAvailable = await this.checkUsernameAvailability(dto.username);
    if (!isAvailable) {
      throw new ConflictException('Username is already taken');
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          username: dto.username,
          onboardingCompleted: true,
        },
      });

      const { passwordHash, ...safeUser } = updatedUser as any;
      return safeUser;
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
        throw new ConflictException('Username is already taken');
      }
      throw error;
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        onboardingCompleted: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    if (!user) {
      throw new BadRequestException('User not found');
    }
    
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.username) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('Username is already taken');
      }
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(dto.displayName !== undefined && { displayName: dto.displayName }),
          ...(dto.username !== undefined && { username: dto.username }),
          ...(dto.bio !== undefined && { bio: dto.bio }),
          ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          onboardingCompleted: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return updatedUser;
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
        throw new ConflictException('Username is already taken');
      }
      throw error;
    }
  }
}
