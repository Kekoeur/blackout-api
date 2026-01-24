import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

/**
 * Data Transfer Object for user registration.
 * Validates email, username, and password constraints.
 */
export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(20, { message: 'Username must not exceed 20 characters' })
  username: string;

  /**
   * Password must be at least 8 characters long and contain:
   * - At least one lowercase letter (a-z)
   * - At least one uppercase letter (A-Z)
   * - At least one digit (0-9)
   * - At least one special character (@$!%*?&)
   */
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100, { message: 'Password must not exceed 100 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
    }
  )
  password: string;
}