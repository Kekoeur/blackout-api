import { Controller, Post, Body, HttpCode, HttpStatus, Query, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

/**
 * Authentication controller handling login and registration endpoints
 *
 * Provides separate authentication endpoints for:
 * - Mobile client application (/auth/mobile/*)
 * - Admin dashboard (/auth/admin/*)
 * - Bar dashboard (/auth/bar/*)
 *
 * Also maintains backward-compatible legacy endpoints for existing clients.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ========== CLIENT MOBILE ==========

  /**
   * Register a new mobile client user
   *
   * @route POST /auth/mobile/register
   * @param dto - Registration data containing email, username, and password
   * @param dto.email - User's email address (must be unique)
   * @param dto.username - User's display name (must be unique)
   * @param dto.password - User's password (plain text, will be hashed)
   * @returns {AuthResponse} JWT token and user information
   * @throws {ConflictException} 409 - If email or username already exists
   * @throws {ConflictException} 409 - If unable to generate unique friend code
   */
  @Post('mobile/register')
  async mobileRegister(@Body() dto: RegisterDto) {
    return this.auth.registerMobile(dto.email, dto.username, dto.password);
  }

  /**
   * Authenticate a mobile client user
   *
   * @route POST /auth/mobile/login
   * @param dto - Login credentials containing email and password
   * @param dto.email - User's email address
   * @param dto.password - User's password
   * @returns {AuthResponse} JWT token and user information (200 OK)
   * @throws {UnauthorizedException} 401 - If credentials are invalid
   */
  @Post('mobile/login')
  @HttpCode(HttpStatus.OK)
  async mobileLogin(@Body() dto: LoginDto) {
    return this.auth.loginMobile(dto.email, dto.password);
  }

  // ========== ADMIN DASHBOARD ==========

  /**
   * Authenticate a super admin user
   *
   * @route POST /auth/admin/login
   * @param dto - Login credentials containing email and password
   * @param dto.email - Admin user's email address
   * @param dto.password - Admin user's password
   * @returns JWT token with SUPER_ADMIN role and user information (200 OK)
   * @throws {UnauthorizedException} 401 - If credentials are invalid or user is not a super admin
   */
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(@Body() dto: LoginDto) {
    return this.auth.loginAdmin(dto.email, dto.password);
  }

  // ========== BAR DASHBOARD ==========

  /**
   * Authenticate a bar user for bar dashboard access
   *
   * @route POST /auth/bar/login
   * @param dto - Login credentials containing email and password
   * @param dto.email - Bar user's email address
   * @param dto.password - Bar user's password
   * @returns JWT token with bar ID and user information (200 OK)
   * @throws {UnauthorizedException} 401 - If credentials are invalid
   * @throws {NotFoundException} 404 - If user has no bar access configured
   */
  @Post('bar/login')
  @HttpCode(HttpStatus.OK)
  async barLogin(@Body() dto: LoginDto) {
    return this.auth.loginBar(dto.email, dto.password);
  }

  // ========== BACKWARD COMPATIBILITY (OLD ENDPOINTS) ==========
  // Ces endpoints sont conservés pour la compatibilité avec les anciennes versions
  // Ils redirigent vers l'authentification mobile par défaut

  /**
   * Legacy registration endpoint for backward compatibility
   *
   * @deprecated Use POST /auth/mobile/register instead
   * @route POST /auth/register
   * @param dto - Registration data containing email, username, and password
   * @returns JWT token and user information
   * @throws {ConflictException} 409 - If email or username already exists
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.auth.registerMobile(dto.email, dto.username, dto.password);
  }

  /**
   * Legacy login endpoint for backward compatibility
   *
   * @deprecated Use POST /auth/mobile/login instead
   * @route POST /auth/login
   * @param dto - Login credentials containing email and password
   * @returns JWT token and user information (200 OK)
   * @throws {UnauthorizedException} 401 - If credentials are invalid
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.auth.loginMobile(dto.email, dto.password);
  }

  // ========== PASSWORD RESET ==========

  /**
   * Request a password reset email
   *
   * @route POST /auth/forgot-password
   * @param dto - Email address to send reset link to
   * @returns Success message (always returns success for security)
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  /**
   * Verify a password reset token
   *
   * @route GET /auth/verify-reset-token
   * @param token - The reset token to verify
   * @returns Token validity status
   */
  @Get('verify-reset-token')
  async verifyResetToken(@Query('token') token: string) {
    return this.auth.verifyResetToken(token);
  }

  /**
   * Reset password using a valid token
   *
   * @route POST /auth/reset-password
   * @param dto - Token and new password
   * @returns Success message
   * @throws {BadRequestException} If token is invalid or expired
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }
}
