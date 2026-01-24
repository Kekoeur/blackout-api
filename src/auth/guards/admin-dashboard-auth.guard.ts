// apps/client-api/src/auth/guards/admin-dashboard-auth.guard.ts

import { Injectable } from '@nestjs/common';
import { BaseTokenAuthGuard } from './base-token-auth.guard';
import { TokenPayload, TokenType } from '../interfaces/token-payload.interface';

/**
 * Admin dashboard authentication guard.
 * Validates Bearer tokens using ADMIN_DASHBOARD_JWT_SECRET.
 * Verifies token type is 'admin-dashboard' and attaches admin info to request.
 *
 * @throws UnauthorizedException if token is missing, invalid, or wrong type
 */
@Injectable()
export class AdminDashboardAuthGuard extends BaseTokenAuthGuard {
  protected getSecret(): string {
    const secret = process.env.ADMIN_DASHBOARD_JWT_SECRET;
    if (!secret) {
      throw new Error('ADMIN_DASHBOARD_JWT_SECRET environment variable is required');
    }
    return secret;
  }

  protected getExpectedTokenType(): TokenType {
    return TokenType.ADMIN_DASHBOARD;
  }

  protected attachUserToRequest(request: any, payload: TokenPayload): void {
    request.adminUser = {
      id: payload.sub,
      email: payload.email,
      type: payload.type,
      role: payload.role,
    };
  }

  protected getContextName(): string {
    return 'Admin Dashboard';
  }
}
