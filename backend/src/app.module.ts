import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { InvitationsModule } from './invitations/invitations.module';
import { CategoriesModule } from './organization/categories/categories.module';
import { LabelsModule } from './organization/labels/labels.module';
import { PreferencesModule } from './preferences/preferences.module';
import { RoomsModule } from './rooms/rooms.module';
import { StudySessionsModule } from './study-sessions/study-sessions.module';
import { TimerModesModule } from './timer-modes/timer-modes.module';
import { TimersModule } from './timers/timers.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    UsersModule,
    PreferencesModule,
    TimerModesModule,
    CategoriesModule,
    LabelsModule,
    StudySessionsModule,
    TimersModule,
    RoomsModule,
    InvitationsModule,
    ChatModule,
    CollaborationModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
