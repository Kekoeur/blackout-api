// apps/client-api/src/auth/auth.service.ts

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthTokenService } from './services/auth-token.service';
import { EmailService } from '../email/email.service';
import { UserForToken } from './interfaces/token-payload.interface';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { generateFriendCode } from '../utils/generate-friend-code';

/**
 * Authentication response returned after successful login or registration
 */
export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    username?: string;
    avatar?: string | null;
    role?: string;
    barId?: string;
    isSuperAdmin?: boolean;
  };
}

/**
 * Authentication service handling user authentication and registration across multiple platforms
 *
 * This service provides authentication methods for:
 * - Mobile client applications (registerMobile, loginMobile)
 * - Admin dashboard (loginAdmin)
 * - Bar dashboard (loginBar)
 *
 * It handles password hashing, JWT token generation, and user validation
 * with platform-specific token generation through the AuthTokenService.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly tokenService: AuthTokenService,
    private readonly emailService: EmailService,
  ) {}

  // ========== CLIENT MOBILE ==========

  /**
   * Registers a new mobile client user
   *
   * Creates a new user account with email, username, and password.
   * Automatically generates a unique friend code for social features.
   * Hashes the password before storing it in the database.
   *
   * @param email - User's email address (must be unique)
   * @param username - User's display name (must be unique)
   * @param password - Plain text password (will be hashed)
   * @returns Authentication response with JWT token and user data
   * @throws {ConflictException} If email or username already exists
   * @throws {ConflictException} If unable to generate unique friend code after 10 attempts
   */
  async registerMobile(email: string, username: string, password: string): Promise<AuthResponse> {
    // Vérifier si existe
    const exists = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (exists) {
      throw new ConflictException('Email or username already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Générer un friendCode unique avec protection contre boucle infinie
    let friendCode = generateFriendCode(username);
    let codeExists = await this.prisma.user.findUnique({
      where: { friendCode },
    });

    let attempts = 0;
    const maxAttempts = 10;

    while (codeExists && attempts < maxAttempts) {
      friendCode = generateFriendCode(username);
      codeExists = await this.prisma.user.findUnique({
        where: { friendCode },
      });
      attempts++;
    }

    if (codeExists) {
      this.logger.error(`Failed to generate unique friend code after ${maxAttempts} attempts for username: ${username}`);
      throw new ConflictException('Unable to generate unique friend code. Please try again.');
    }

    // Créer user avec friendCode
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        friendCode,
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        friendCode: true,
      },
    });

    const token = this.tokenService.generateClientMobileToken(user.id, user.email, user.username);

    return {
      access_token: token,
      user,
    };
  }

  /**
   * Authenticates a mobile client user
   *
   * Validates user credentials and returns a JWT token for mobile app access.
   * Logs failed login attempts for security monitoring.
   *
   * @param email - User's email address
   * @param password - User's plain text password
   * @returns Authentication response with JWT token and user data
   * @throws {UnauthorizedException} If credentials are invalid (wrong email or password)
   */
  async loginMobile(email: string, password: string): Promise<AuthResponse> {
    const user = await this.users.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      this.logger.warn('Failed mobile login attempt for email: ' + email);
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.tokenService.generateClientMobileToken(user.id, user.email, user.username);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
      },
    };
  }

  // ========== ADMIN DASHBOARD ==========

  /**
   * Authenticates a super admin user for the admin dashboard
   *
   * Validates credentials against the barUser table where isSuperAdmin is true.
   * Only users with super admin privileges can access the admin dashboard.
   * Logs failed login attempts for security monitoring.
   *
   * @param email - Admin user's email address
   * @param password - Admin user's plain text password
   * @returns Authentication response with JWT token and admin user data
   * @throws {UnauthorizedException} If credentials are invalid or user is not a super admin
   */
  async loginAdmin(email: string, password: string): Promise<AuthResponse> {
    // Chercher un barUser avec isSuperAdmin = true
    const admin = await this.prisma.barUser.findUnique({
      where: { email },
    });

    if (!admin || !admin.isSuperAdmin || !(await bcrypt.compare(password, admin.password))) {
      this.logger.warn('Failed admin login attempt for email: ' + email);
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const token = this.tokenService.generateAdminDashboardToken(admin.id, admin.email, 'SUPER_ADMIN');

    return {
      access_token: token,
      user: {
        id: admin.id,
        email: admin.email,
        username: admin.name,
        role: 'SUPER_ADMIN',
      },
    };
  }

  // ========== BAR DASHBOARD ==========

  /**
   * Authenticates a bar user for the bar dashboard
   *
   * Validates credentials against the barUser table and retrieves the primary bar
   * the user has access to. The JWT token includes the bar ID for authorization.
   * Logs failed login attempts for security monitoring.
   *
   * @param email - Bar user's email address
   * @param password - Bar user's plain text password
   * @returns Authentication response with JWT token, user data, and primary bar ID (if any)
   * @throws {UnauthorizedException} If credentials are invalid
   */
  async loginBar(email: string, password: string): Promise<AuthResponse> {
    // Chercher un barUser avec ses accès aux bars
    const barUser = await this.prisma.barUser.findUnique({
      where: { email },
      include: {
        barAccess: {
          include: {
            bar: true,
          },
          take: 1, // On prend le premier bar auquel l'utilisateur a accès
        },
      },
    });

    if (!barUser || !(await bcrypt.compare(password, barUser.password))) {
      this.logger.warn('Failed bar login attempt for email: ' + email);
      throw new UnauthorizedException('Invalid bar credentials');
    }

    // Récupérer le premier bar si l'utilisateur en a un
    const primaryBarAccess = barUser.barAccess?.[0];

    const token = this.tokenService.generateBarDashboardToken(
      barUser.id,
      barUser.email,
      primaryBarAccess?.bar?.id // Peut être undefined si l'utilisateur n'a pas de bar
    );

    return {
      access_token: token,
      user: {
        id: barUser.id,
        email: barUser.email,
        username: barUser.name,
        isSuperAdmin: barUser.isSuperAdmin,
        barId: primaryBarAccess?.bar?.id, // Peut être undefined
      },
    };
  }

  // ========== LEGACY METHODS (pour compatibilité) ==========

  /**
   * Legacy registration method for backward compatibility
   *
   * @deprecated Use registerMobile instead
   * @param email - User's email address
   * @param username - User's display name
   * @param password - User's plain text password
   * @returns Authentication response with JWT token and user data
   */
  async register(email: string, username: string, password: string) {
    return this.registerMobile(email, username, password);
  }

  /**
   * Legacy login method for backward compatibility
   *
   * @deprecated Use loginMobile instead
   * @param email - User's email address
   * @param password - User's plain text password
   * @returns Authentication response with JWT token and user data
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    return this.loginMobile(email, password);
  }

  /**
   * Validates and retrieves a user by ID
   *
   * @param userId - The unique identifier of the user
   * @returns The user object if found
   */
  async validateUser(userId: string) {
    return this.users.findById(userId);
  }

  /**
   * Generates JWT tokens for a user (legacy method)
   *
   * @deprecated Use AuthTokenService methods instead
   * @param user - User data for token generation
   * @returns Authentication response with JWT token and user data
   * @private
   */
  private generateTokens(user: UserForToken): AuthResponse {
    const payload = { sub: user.id, email: user.email };

    return {
      access_token: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
      },
    };
  }

  // ========== PASSWORD RESET ==========

  /**
   * Sends a password reset email to the user
   *
   * @param email - User's email address
   * @returns Success message (always returns success for security - don't reveal if email exists)
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Always return success for security (don't reveal if email exists)
    if (!user) {
      this.logger.log(`Password reset requested for non-existent email: ${email}`);
      return { message: 'Si cette adresse email existe, un email de réinitialisation a été envoyé.' };
    }

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Invalidate any existing tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Create new reset token
    await this.prisma.passwordResetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Send email
    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.username,
      resetToken,
    );

    this.logger.log(`Password reset email sent to: ${email}`);

    return { message: 'Si cette adresse email existe, un email de réinitialisation a été envoyé.' };
  }

  /**
   * Verifies if a reset token is valid
   *
   * @param token - The reset token to verify
   * @returns Token validity status and associated email
   */
  async verifyResetToken(token: string) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { email: true, username: true } } },
    });

    if (!resetToken) {
      return { valid: false, message: 'Token invalide' };
    }

    if (resetToken.used) {
      return { valid: false, message: 'Ce lien a déjà été utilisé' };
    }

    if (resetToken.expiresAt < new Date()) {
      return { valid: false, message: 'Ce lien a expiré' };
    }

    return {
      valid: true,
      email: resetToken.user.email,
      username: resetToken.user.username,
    };
  }

  /**
   * Resets the user's password using a valid token
   *
   * @param token - The reset token
   * @param newPassword - The new password
   * @returns Success message
   */
  async resetPassword(token: string, newPassword: string) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException('Token invalide');
    }

    if (resetToken.used) {
      throw new BadRequestException('Ce lien a déjà été utilisé');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Ce lien a expiré');
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password and mark token as used
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);

    this.logger.log(`Password reset successful for user: ${resetToken.user.email}`);

    return { message: 'Votre mot de passe a été réinitialisé avec succès' };
  }

  /**
   * Admin-triggered password reset for a mobile user
   *
   * @param userId - The user ID to send reset email to
   * @returns Success status
   */
  async sendPasswordResetForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return this.forgotPassword(user.email);
  }
}
