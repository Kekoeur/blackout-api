// apps/client-api/src/auth/guards/base-token-auth.guard.ts

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenPayload, TokenType } from '../interfaces/token-payload.interface';

/**
 * Base authentication guard implementing common JWT verification logic.
 * Subclasses must implement abstract methods to specify token secret and type.
 *
 * @abstract
 */
@Injectable()
export abstract class BaseTokenAuthGuard implements CanActivate {
  protected readonly logger: Logger;

  constructor(protected jwt: JwtService) {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Get the JWT secret for token verification.
   * @returns The JWT secret string
   */
  protected abstract getSecret(): string;

  /**
   * Get the expected token type for validation.
   * @returns The expected TokenType
   */
  protected abstract getExpectedTokenType(): TokenType;

  /**
   * Attach validated user information to the request object.
   * @param request The HTTP request object
   * @param payload The validated JWT payload
   */
  protected abstract attachUserToRequest(request: any, payload: TokenPayload): void;

  /**
   * Get the authentication context name for logging purposes.
   * @returns A human-readable context name (e.g., "Mobile", "Admin", "Bar")
   */
  protected abstract getContextName(): string;

  /**
   * Validates JWT token from request headers.
   * @param context Execution context containing the HTTP request
   * @returns true if token is valid, throws UnauthorizedException otherwise
   * @throws UnauthorizedException if token is missing, invalid, or wrong type
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn(`${this.getContextName()} authentication attempt without token`);
      throw new UnauthorizedException('No token provided');
    }

    try {
      const secret = this.getSecret();
      if (!secret) {
        this.logger.error(`${this.getContextName()} JWT secret is not configured`);
        throw new UnauthorizedException('Authentication configuration error');
      }

      const payload = this.jwt.verify<TokenPayload>(token, { secret });

      if (payload.type !== this.getExpectedTokenType()) {
        this.logger.warn(
          `Invalid token type for ${this.getContextName()}: expected ${this.getExpectedTokenType()}, got ${payload.type}`
        );
        throw new UnauthorizedException('Invalid token type');
      }

      this.attachUserToRequest(request, payload);
      return true;
    } catch (error) {
      this.logger.warn(`${this.getContextName()} token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Extract Bearer token from Authorization header.
   * @param request The HTTP request object
   * @returns The extracted token or undefined if not present
   */
  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }
    return authHeader.replace('Bearer ', '');
  }
}
