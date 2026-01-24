import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

/**
 * Custom throttler guard with enhanced error messages.
 * Protects endpoints from brute force attacks.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    throw new ThrottlerException(
      'Too many requests. Please try again later.'
    );
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Track by IP address
    return req.ip || req.connection.remoteAddress;
  }
}
