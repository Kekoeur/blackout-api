// apps/client-api/src/auth/guards/client-mobile-auth.guard.ts

import { Injectable } from '@nestjs/common';
import { BaseTokenAuthGuard } from './base-token-auth.guard';
import { TokenPayload, TokenType } from '../interfaces/token-payload.interface';

/**
 * Client mobile authentication guard.
 * Validates Bearer tokens using CLIENT_MOBILE_JWT_SECRET.
 * Verifies token type is 'client-mobile' and attaches user info to request.
 *
 * @throws UnauthorizedException if token is missing, invalid, or wrong type
 */
@Injectable()
export class ClientMobileAuthGuard extends BaseTokenAuthGuard {
  protected getSecret(): string {
    const secret = process.env.CLIENT_MOBILE_JWT_SECRET;
    if (!secret) {
      throw new Error('CLIENT_MOBILE_JWT_SECRET environment variable is required');
    }
    return secret;
  }

  protected getExpectedTokenType(): TokenType {
    return TokenType.CLIENT_MOBILE;
  }

  protected attachUserToRequest(request: any, payload: TokenPayload): void {
    request.user = {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      type: payload.type,
    };
  }

  protected getContextName(): string {
    return 'Mobile Client';
  }
}
