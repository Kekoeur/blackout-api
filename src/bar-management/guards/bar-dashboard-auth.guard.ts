// apps/client-api/src/bar-management/guards/bar-dashboard-auth.guard.ts

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class BarDashboardAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = this.jwt.verify(token, {
        secret: process.env.BAR_DASHBOARD_JWT_SECRET || 'bar-dashboard-secret',
      });

      if (payload.type !== 'bar-dashboard') {
        throw new UnauthorizedException('Invalid token type');
      }

      request.barUser = {
        id: payload.sub,
        email: payload.email,
        type: payload.type,
      }
      
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}