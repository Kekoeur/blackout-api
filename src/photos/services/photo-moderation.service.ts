import { Injectable, Logger } from '@nestjs/common';
import { GoogleVisionModerationProvider } from '../providers/google-vision-moderation.provider';
import { AWSRekognitionModerationProvider } from '../providers/aws-rekognition-moderation.provider';
import { NSFWJSModerationProvider } from '../providers/nsfwjs-moderation.provider';
import { ModerationResult } from '../interfaces/moderation.interface';
import { ModerationStatus, ModerationProvider } from '../enums/moderation.enum';

/**
 * Photo moderation service orchestrator.
 * Manages multiple moderation providers and selects the best result.
 *
 * Configuration via environment variables:
 * - PHOTO_MODERATION_PROVIDER: preferred provider (GOOGLE_VISION, AWS_REKOGNITION, NSFWJS)
 * - GOOGLE_VISION_MODERATION_ENABLED: enable/disable Google Vision
 * - AWS_REKOGNITION_MODERATION_ENABLED: enable/disable AWS Rekognition
 * - NSFWJS_MODERATION_ENABLED: enable/disable NSFW.js (default: true for testing)
 * - PHOTO_MODERATION_FALLBACK: enable fallback to other providers on error
 */
@Injectable()
export class PhotoModerationService {
  private readonly logger = new Logger(PhotoModerationService.name);
  private readonly preferredProvider: ModerationProvider;
  private readonly enableFallback: boolean;

  constructor(
    private readonly googleVision: GoogleVisionModerationProvider,
    private readonly awsRekognition: AWSRekognitionModerationProvider,
    private readonly nsfwjs: NSFWJSModerationProvider,
  ) {
    // Read configuration
    const providerConfig = process.env.PHOTO_MODERATION_PROVIDER?.toUpperCase() || 'NSFWJS';
    this.preferredProvider = ModerationProvider[providerConfig as keyof typeof ModerationProvider] || ModerationProvider.NSFWJS;
    this.enableFallback = process.env.PHOTO_MODERATION_FALLBACK !== 'false';

    this.logger.log(`Photo moderation service initialized`);
    this.logger.log(`Preferred provider: ${this.preferredProvider}`);
    this.logger.log(`Fallback enabled: ${this.enableFallback}`);
    this.logger.log(`Available providers: ${this.getAvailableProviders().join(', ')}`);
  }

  /**
   * Get list of enabled providers
   */
  private getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (this.googleVision.isEnabled()) providers.push('GOOGLE_VISION');
    if (this.awsRekognition.isEnabled()) providers.push('AWS_REKOGNITION');
    if (this.nsfwjs.isEnabled()) providers.push('NSFWJS');
    return providers;
  }

  /**
   * Moderate a photo using configured provider
   * @param imageUrl - URL of the image to moderate
   * @returns Moderation result with status and details
   */
  async moderatePhoto(imageUrl: string): Promise<ModerationResult> {
    this.logger.log(`Moderating photo: ${imageUrl.substring(0, 50)}...`);

    try {
      // Try preferred provider first
      const result = await this.moderateWithProvider(this.preferredProvider, imageUrl);
      return result;
    } catch (error) {
      this.logger.warn(
        `Preferred provider ${this.preferredProvider} failed: ${error.message}`
      );

      // Try fallback providers if enabled
      if (this.enableFallback) {
        const fallbackResult = await this.tryFallbackProviders(imageUrl);
        if (fallbackResult) {
          return fallbackResult;
        }
      }

      // All providers failed - return safe default
      this.logger.error('All moderation providers failed, defaulting to manual review');
      return {
        status: ModerationStatus.NEEDS_REVIEW,
        confidence: 0,
        reasons: ['Automatic moderation failed - requires manual review'],
        scores: {},
        provider: 'NONE',
      };
    }
  }

  /**
   * Moderate using specific provider
   */
  private async moderateWithProvider(
    provider: ModerationProvider,
    imageUrl: string,
  ): Promise<ModerationResult> {
    switch (provider) {
      case ModerationProvider.GOOGLE_VISION:
        if (!this.googleVision.isEnabled()) {
          throw new Error('Google Vision provider is not enabled');
        }
        return await this.googleVision.moderateImage(imageUrl);

      case ModerationProvider.AWS_REKOGNITION:
        if (!this.awsRekognition.isEnabled()) {
          throw new Error('AWS Rekognition provider is not enabled');
        }
        return await this.awsRekognition.moderateImage(imageUrl);

      case ModerationProvider.NSFWJS:
        if (!this.nsfwjs.isEnabled()) {
          throw new Error('NSFW.js provider is not enabled');
        }
        return await this.nsfwjs.moderateImage(imageUrl);

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Try fallback providers in order
   */
  private async tryFallbackProviders(imageUrl: string): Promise<ModerationResult | null> {
    const fallbackOrder: ModerationProvider[] = [
      ModerationProvider.NSFWJS,
      ModerationProvider.GOOGLE_VISION,
      ModerationProvider.AWS_REKOGNITION,
    ].filter((p) => p !== this.preferredProvider);

    for (const provider of fallbackOrder) {
      try {
        this.logger.log(`Trying fallback provider: ${provider}`);
        const result = await this.moderateWithProvider(provider, imageUrl);
        this.logger.log(`Fallback provider ${provider} succeeded`);
        return result;
      } catch (error) {
        this.logger.warn(`Fallback provider ${provider} failed: ${error.message}`);
        continue;
      }
    }

    return null;
  }

  /**
   * Batch moderate multiple photos
   * @param imageUrls - Array of image URLs to moderate
   * @returns Array of moderation results
   */
  async batchModerate(imageUrls: string[]): Promise<ModerationResult[]> {
    this.logger.log(`Batch moderating ${imageUrls.length} photos`);

    const results = await Promise.allSettled(
      imageUrls.map((url) => this.moderatePhoto(url))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        this.logger.error(`Batch moderation failed for image ${index}: ${result.reason}`);
        return {
          status: ModerationStatus.NEEDS_REVIEW,
          confidence: 0,
          reasons: ['Moderation failed'],
          scores: {},
          provider: 'NONE',
        };
      }
    });
  }

  /**
   * Get moderation statistics
   */
  getProviderStatus() {
    return {
      preferred: this.preferredProvider,
      fallbackEnabled: this.enableFallback,
      providers: {
        googleVision: {
          enabled: this.googleVision.isEnabled(),
          name: 'Google Cloud Vision API',
        },
        awsRekognition: {
          enabled: this.awsRekognition.isEnabled(),
          name: 'AWS Rekognition',
        },
        nsfwjs: {
          enabled: this.nsfwjs.isEnabled(),
          name: 'NSFW.js (Open Source)',
        },
      },
    };
  }
}
