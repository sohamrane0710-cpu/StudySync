import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;

  @IsNotEmpty()
  password!: string;
}
