// apps/client-api/src/auth/interfaces/token-payload.interface.ts

export enum TokenType {
  CLIENT_MOBILE = 'client-mobile',
  ADMIN_DASHBOARD = 'admin-dashboard',
  BAR_DASHBOARD = 'bar-dashboard',
}

/**
 * JWT Token Payload interface
 * Represents the data encoded in JWT tokens across all application types
 */
export interface TokenPayload {
  /** User ID (JWT standard 'sub' claim) */
  sub: string;
  /** User email address */
  email: string;
  /** Token type indicating which application this token is for */
  type: TokenType;
  /** Username (optional, present in CLIENT_MOBILE tokens) */
  username?: string;
  /** User role (optional, present in ADMIN_DASHBOARD tokens) */
  role?: string;
  /** Bar ID (optional, present in BAR_DASHBOARD tokens) */
  barId?: string;
}

/**
 * Validated User interface
 * Represents a user object after JWT validation
 */
export interface ValidatedUser {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  friendCode: string;
  createdAt: Date;
}

/**
 * User object with minimal fields for token generation
 */
export interface UserForToken {
  id: string;
  email: string;
  username?: string;
  avatar?: string | null;
}
