import { Module } from '@nestjs/common';
import { StudySessionsModule } from '../study-sessions/study-sessions.module';
import { CollaborationController } from './collaboration.controller';
import { CollaborationGateway } from './collaboration.gateway';
import { CollaborationService } from './collaboration.service';

@Module({
  imports: [StudySessionsModule],
  controllers: [CollaborationController],
  providers: [CollaborationService, CollaborationGateway],
  exports: [CollaborationService, CollaborationGateway],
})
export class CollaborationModule {}
