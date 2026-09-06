import { IsNotEmpty, Matches, MaxLength, MinLength } from 'class-validator';

export class CompleteOnboardingDto {
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]{3,20}$/, {
    message: 'Username must be 3-20 characters long and can only contain letters, numbers, and underscores',
  })
  username!: string;
}
