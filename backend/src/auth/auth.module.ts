import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';

@Global()
@Module({
  providers: [AuthService, SupabaseAuthGuard, OptionalAuthGuard],
  exports: [AuthService, SupabaseAuthGuard, OptionalAuthGuard],
})
export class AuthModule {}
