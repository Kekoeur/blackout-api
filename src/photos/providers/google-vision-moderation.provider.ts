import { Injectable, Logger } from '@nestjs/common';
import { ModerationResult, GoogleVisionDetection } from '../interfaces/moderation.interface';
import { ModerationStatus, RiskLevel } from '../enums/moderation.enum';

// Dynamic import to make @google-cloud/vision optional
let vision: any;
try {
  vision = require('@google-cloud/vision');
} catch (error) {
  // Package not installed - provider will be disabled
  vision = null;
}

/**
 * Google Cloud Vision API moderation provider.
 * Provides Safe Search detection for adult content, violence, etc.
 *
 * Setup:
 * 1. Enable Cloud Vision API in Google Cloud Console
 * 2. Create service account and download JSON key
 * 3. Set GOOGLE_APPLICATION_CREDENTIALS env var to key path
 */
@Injectable()
export class GoogleVisionModerationProvider {
  private readonly logger = new Logger(GoogleVisionModerationProvider.name);
  private client: any;
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.GOOGLE_VISION_MODERATION_ENABLED === 'true';

    if (this.enabled) {
      if (!vision) {
        this.logger.warn('Google Vision package not installed. Run: npm install @google-cloud/vision');
        this.enabled = false;
      } else {
        try {
          this.client = new vision.ImageAnnotatorClient();
          this.logger.log('Google Vision moderation provider initialized');
        } catch (error) {
          this.logger.error('Failed to initialize Google Vision client:', error.message);
          this.enabled = false;
        }
      }
    } else {
      this.logger.log('Google Vision moderation provider is disabled');
    }
  }

  /**
   * Check if provider is enabled and ready
   */
  isEnabled(): boolean {
    return this.enabled && !!this.client;
  }

  /**
   * Moderate image using Google Vision Safe Search
   * @param imageUrl - URL of the image to moderate
   * @returns Moderation result with scores and status
   */
  async moderateImage(imageUrl: string): Promise<ModerationResult> {
    if (!this.isEnabled()) {
      throw new Error('Google Vision moderation provider is not enabled');
    }

    try {
      const [result] = await this.client.safeSearchDetection(imageUrl);
      const detections = result.safeSearchAnnotation as GoogleVisionDetection;

      const reasons: string[] = [];
      let status = ModerationStatus.APPROVED;

      // Check adult content
      if (this.isHighRisk(detections.adult)) {
        reasons.push('Adult content detected');
        status = ModerationStatus.REJECTED;
      } else if (this.isMediumRisk(detections.adult)) {
        reasons.push('Possible adult content');
        status = ModerationStatus.NEEDS_REVIEW;
      }

      // Check violence
      if (this.isHighRisk(detections.violence)) {
        reasons.push('Violent content detected');
        status = ModerationStatus.REJECTED;
      } else if (this.isMediumRisk(detections.violence)) {
        reasons.push('Possible violent content');
        if (status === ModerationStatus.APPROVED) {
          status = ModerationStatus.NEEDS_REVIEW;
        }
      }

      // Check racy content
      if (this.isHighRisk(detections.racy)) {
        reasons.push('Suggestive content detected');
        if (status === ModerationStatus.APPROVED) {
          status = ModerationStatus.NEEDS_REVIEW;
        }
      }

      const confidence = this.calculateConfidence(detections);
      const scores = this.convertToScores(detections);

      this.logger.log(
        `Google Vision moderation: ${status} (${confidence}%) - ${reasons.join(', ') || 'Clean'}`
      );

      return {
        status,
        confidence,
        reasons,
        scores,
        details: detections,
        provider: 'GOOGLE_VISION',
      };
    } catch (error) {
      this.logger.error('Google Vision moderation error:', error.message);
      throw error;
    }
  }

  /**
   * Check if risk level is high
   */
  private isHighRisk(level: RiskLevel): boolean {
    return level === RiskLevel.VERY_LIKELY || level === RiskLevel.LIKELY;
  }

  /**
   * Check if risk level is medium
   */
  private isMediumRisk(level: RiskLevel): boolean {
    return level === RiskLevel.POSSIBLE;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(detections: GoogleVisionDetection): number {
    const scores = {
      [RiskLevel.VERY_UNLIKELY]: 95,
      [RiskLevel.UNLIKELY]: 80,
      [RiskLevel.POSSIBLE]: 50,
      [RiskLevel.LIKELY]: 20,
      [RiskLevel.VERY_LIKELY]: 5,
    };

    const avgScore = (
      scores[detections.adult] +
      scores[detections.violence] +
      scores[detections.racy]
    ) / 3;

    return Math.round(avgScore);
  }

  /**
   * Convert risk levels to numeric scores (0-100)
   */
  private convertToScores(detections: GoogleVisionDetection) {
    const riskToScore = (level: RiskLevel): number => {
      const map = {
        [RiskLevel.VERY_UNLIKELY]: 5,
        [RiskLevel.UNLIKELY]: 20,
        [RiskLevel.POSSIBLE]: 50,
        [RiskLevel.LIKELY]: 80,
        [RiskLevel.VERY_LIKELY]: 95,
      };
      return map[level] || 0;
    };

    return {
      adult: riskToScore(detections.adult),
      violence: riskToScore(detections.violence),
      racy: riskToScore(detections.racy),
      medical: riskToScore(detections.medical),
    };
  }
}
