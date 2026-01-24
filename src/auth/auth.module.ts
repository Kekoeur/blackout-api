import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthTokenService } from './services/auth-token.service';
import { UsersModule } from '../users/users.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule,
    EmailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || (() => {
        throw new Error('JWT_SECRET environment variable is required');
      })(),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthTokenService, JwtStrategy, PrismaService],
  exports: [AuthService, AuthTokenService, JwtModule],
})
export class AuthModule {}
