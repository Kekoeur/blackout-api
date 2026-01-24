import { IsEmail, IsString } from 'class-validator';

/**
 * Data Transfer Object for user login.
 * Validates email and password presence.
 */
export class LoginDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  password: string;
}