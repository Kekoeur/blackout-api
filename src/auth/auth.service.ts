// apps/client-api/src/auth/auth.service.ts

import { 
  Injectable, 
  UnauthorizedException, 
  ConflictException, // ⭐ AJOUTER
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service'; // ⭐ AJOUTER
import * as bcrypt from 'bcrypt';
import { generateFriendCode } from '../utils/generate-friend-code';

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    username: string;
    avatar: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService, // ⭐ AJOUTER
  ) {}

  async register(email: string, username: string, password: string) {
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

    // Générer un friendCode unique
    let friendCode = generateFriendCode(username);
    
    // Vérifier l'unicité (boucle jusqu'à trouver un code unique)
    let codeExists = await this.prisma.user.findUnique({
      where: { friendCode },
    });
    
    while (codeExists) {
      friendCode = generateFriendCode(username);
      codeExists = await this.prisma.user.findUnique({
        where: { friendCode },
      });
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

    const token = this.jwt.sign({ sub: user.id, email: user.email });

    return {
      access_token: token,
      user,
    };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.users.findByEmail(email);
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async validateUser(userId: string) {
    return this.users.findById(userId);
  }

  private generateTokens(user: any): AuthResponse {
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
}