// apps/client-api/src/auth/jwt-auth.guard.ts

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    console.log('🔐 [JwtAuthGuard] Token received:', token ? 'YES' : 'NO'); // ⭐ DEBUG

    if (!token) {
      console.error('❌ [JwtAuthGuard] No token provided'); // ⭐ DEBUG
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      console.log('✅ [JwtAuthGuard] Token valid for user:', payload.sub); // ⭐ DEBUG
      console.log('📦 [JwtAuthGuard] Full payload:', payload);

      request.user = {
        id: payload.sub,
        email: payload.email,
        username: payload.username,
      };
      console.log('✅ [JwtAuthGuard] Request.user set:', request.user);
      return true;
    } catch (error) {
      console.error('❌ [JwtAuthGuard] Token verification failed:', error.message); // ⭐ DEBUG
      throw new UnauthorizedException('Invalid token');
    }
  }
}