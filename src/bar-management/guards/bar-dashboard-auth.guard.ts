// apps/client-api/src/bar-management/guards/bar-dashboard-auth.guard.ts

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BaseTokenAuthGuard } from '../../auth/guards/base-token-auth.guard';
import { TokenPayload, TokenType } from '../../auth/interfaces/token-payload.interface';

/**
 * Bar dashboard authentication guard.
 * Validates Bearer tokens using BAR_DASHBOARD_JWT_SECRET.
 * Verifies token type is 'bar-dashboard' and attaches bar user info to request.
 *
 * @throws UnauthorizedException if token is missing, invalid, or wrong type
 */
@Injectable()
export class BarDashboardAuthGuard extends BaseTokenAuthGuard {
  constructor(jwt: JwtService) {
    super(jwt);
  }

  protected getSecret(): string {
    const secret = process.env.BAR_DASHBOARD_JWT_SECRET;
    if (!secret) {
      throw new Error('BAR_DASHBOARD_JWT_SECRET environment variable is required');
    }
    return secret;
  }

  protected getExpectedTokenType(): TokenType {
    return TokenType.BAR_DASHBOARD;
  }

  protected attachUserToRequest(request: any, payload: TokenPayload): void {
    request.barUser = {
      id: payload.sub,
      email: payload.email,
      type: payload.type,
      barId: payload.barId,
    };
  }

  protected getContextName(): string {
    return 'Bar Dashboard';
  }
}
