import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;

  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
