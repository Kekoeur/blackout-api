// apps/client-api/src/auth/services/auth-token.service.ts

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenType, TokenPayload } from '../interfaces/token-payload.interface';

// Re-export for backward compatibility
export { TokenType, TokenPayload } from '../interfaces/token-payload.interface';

/**
 * Service for generating and verifying JWT tokens across multiple application platforms
 *
 * This service handles token generation for three separate platforms, each with its own
 * JWT secret and token structure:
 * - Client Mobile: For mobile app users (30-day expiration)
 * - Admin Dashboard: For super admin users (7-day expiration)
 * - Bar Dashboard: For bar owners and staff (7-day expiration)
 *
 * Each token type uses a different secret key from environment variables for security isolation.
 */
@Injectable()
export class AuthTokenService {
  constructor(private jwt: JwtService) {}

  /**
   * Generates a JWT token for the mobile client application
   *
   * Creates a token with CLIENT_MOBILE type that expires in 30 days.
   * The token includes user ID, email, and username in the payload.
   *
   * @param userId - The unique identifier of the mobile user
   * @param email - The user's email address
   * @param username - The user's display name
   * @returns A signed JWT token string using CLIENT_MOBILE_JWT_SECRET
   */
  generateClientMobileToken(userId: string, email: string, username: string): string {
    const payload: TokenPayload = {
      sub: userId,
      email,
      username,
      type: TokenType.CLIENT_MOBILE,
    };

    return this.jwt.sign(payload, {
      secret: process.env.CLIENT_MOBILE_JWT_SECRET,
      expiresIn: '30d',
    });
  }

  /**
   * Generates a JWT token for the admin dashboard application
   *
   * Creates a token with ADMIN_DASHBOARD type that expires in 7 days.
   * The token includes admin ID, email, and role (typically 'SUPER_ADMIN') in the payload.
   *
   * @param adminId - The unique identifier of the admin user
   * @param email - The admin user's email address
   * @param role - The admin's role (e.g., 'SUPER_ADMIN')
   * @returns A signed JWT token string using ADMIN_DASHBOARD_JWT_SECRET
   */
  generateAdminDashboardToken(adminId: string, email: string, role: string): string {
    const payload: TokenPayload = {
      sub: adminId,
      email,
      role,
      type: TokenType.ADMIN_DASHBOARD,
    };

    return this.jwt.sign(payload, {
      secret: process.env.ADMIN_DASHBOARD_JWT_SECRET,
      expiresIn: '7d',
    });
  }

  /**
   * Generates a JWT token for the bar dashboard application
   *
   * Creates a token with BAR_DASHBOARD type that expires in 7 days.
   * The token includes bar owner ID, email, and the associated bar ID for authorization.
   *
   * @param barOwnerId - The unique identifier of the bar owner/user
   * @param email - The bar user's email address
   * @param barId - The unique identifier of the bar the user has access to (optional for users without bars)
   * @returns A signed JWT token string using BAR_DASHBOARD_JWT_SECRET
   */
  generateBarDashboardToken(barOwnerId: string, email: string, barId?: string): string {
    const payload: TokenPayload = {
      sub: barOwnerId,
      email,
      barId: barId || undefined,
      type: TokenType.BAR_DASHBOARD,
    };

    return this.jwt.sign(payload, {
      secret: process.env.BAR_DASHBOARD_JWT_SECRET,
      expiresIn: '7d',
    });
  }

  /**
   * Verifies a JWT token and returns its payload
   *
   * Validates the token signature using the appropriate secret based on the token type.
   * The token type must match the secret used to sign it, or verification will fail.
   *
   * @param token - The JWT token string to verify
   * @param type - The type of token (CLIENT_MOBILE, ADMIN_DASHBOARD, or BAR_DASHBOARD)
   * @returns The decoded token payload containing user information
   * @throws {Error} If token type is invalid
   * @throws {JsonWebTokenError} If token verification fails (invalid signature, expired, etc.)
   */
  verifyToken(token: string, type: TokenType): TokenPayload {
    let secret: string;

    switch (type) {
      case TokenType.CLIENT_MOBILE:
        secret = process.env.CLIENT_MOBILE_JWT_SECRET;
        break;
      case TokenType.ADMIN_DASHBOARD:
        secret = process.env.ADMIN_DASHBOARD_JWT_SECRET;
        break;
      case TokenType.BAR_DASHBOARD:
        secret = process.env.BAR_DASHBOARD_JWT_SECRET;
        break;
      default:
        throw new Error('Invalid token type');
    }

    return this.jwt.verify(token, { secret });
  }
}
