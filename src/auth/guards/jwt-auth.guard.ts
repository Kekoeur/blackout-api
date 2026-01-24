// apps/client-api/src/auth/jwt-auth.guard.ts

import { Injectable } from '@nestjs/common';
import { BaseTokenAuthGuard } from './base-token-auth.guard';
import { TokenPayload, TokenType } from '../interfaces/token-payload.interface';

/**
 * JWT authentication guard for general API requests (mobile client).
 * Validates Bearer tokens using CLIENT_MOBILE_JWT_SECRET and attaches user info to request.
 *
 * @throws UnauthorizedException if token is missing or invalid
 */
@Injectable()
export class JwtAuthGuard extends BaseTokenAuthGuard {
  protected getSecret(): string {
    return process.env.CLIENT_MOBILE_JWT_SECRET || '';
  }

  protected getExpectedTokenType(): TokenType {
    return TokenType.CLIENT_MOBILE;
  }

  protected attachUserToRequest(request: any, payload: TokenPayload): void {
    request.user = {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
    };
  }

  protected getContextName(): string {
    return 'General API';
  }
}
