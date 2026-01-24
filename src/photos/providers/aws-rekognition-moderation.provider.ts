import { Injectable, Logger } from '@nestjs/common';
import { ModerationResult, RekognitionLabel } from '../interfaces/moderation.interface';
import { ModerationStatus } from '../enums/moderation.enum';
import axios from 'axios';

// Dynamic import to make @aws-sdk/client-rekognition optional
let RekognitionClient: any;
let DetectModerationLabelsCommand: any;
try {
  const awsRekognition = require('@aws-sdk/client-rekognition');
  RekognitionClient = awsRekognition.RekognitionClient;
  DetectModerationLabelsCommand = awsRekognition.DetectModerationLabelsCommand;
} catch (error) {
  // Package not installed - provider will be disabled
  RekognitionClient = null;
  DetectModerationLabelsCommand = null;
}

/**
 * AWS Rekognition moderation provider.
 * Detects inappropriate, unwanted, or offensive content.
 *
 * Setup:
 * 1. Enable AWS Rekognition in AWS Console
 * 2. Create IAM user with Rekognition permissions
 * 3. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars
 */
@Injectable()
export class AWSRekognitionModerationProvider {
  private readonly logger = new Logger(AWSRekognitionModerationProvider.name);
  private client: any;
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.AWS_REKOGNITION_MODERATION_ENABLED === 'true';

    if (this.enabled) {
      if (!RekognitionClient) {
        this.logger.warn('AWS Rekognition package not installed. Run: npm install @aws-sdk/client-rekognition');
        this.enabled = false;
      } else {
        try {
          this.client = new RekognitionClient({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
          });
          this.logger.log('AWS Rekognition moderation provider initialized');
        } catch (error) {
          this.logger.error('Failed to initialize AWS Rekognition client:', error.message);
          this.enabled = false;
        }
      }
    } else {
      this.logger.log('AWS Rekognition moderation provider is disabled');
    }
  }

  /**
   * Check if provider is enabled and ready
   */
  isEnabled(): boolean {
    return this.enabled && !!this.client;
  }

  /**
   * Moderate image using AWS Rekognition
   * @param imageUrl - URL of the image to moderate
   * @returns Moderation result with labels and scores
   */
  async moderateImage(imageUrl: string): Promise<ModerationResult> {
    if (!this.isEnabled()) {
      throw new Error('AWS Rekognition moderation provider is not enabled');
    }

    try {
      // Download image as buffer
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageBytes = Buffer.from(response.data);

      // Call Rekognition
      const command = new DetectModerationLabelsCommand({
        Image: { Bytes: imageBytes },
        MinConfidence: 50, // Only labels with 50%+ confidence
      });

      const result = await this.client.send(command);
      const labels = (result.ModerationLabels || []) as RekognitionLabel[];

      const reasons: string[] = [];
      let status = ModerationStatus.APPROVED;
      const scores = { adult: 0, violence: 0, racy: 0 };

      // Categorize labels
      labels.forEach((label) => {
        const name = label.Name.toLowerCase();
        const confidence = label.Confidence;

        if (this.isAdultContent(name)) {
          scores.adult = Math.max(scores.adult, confidence);
          if (confidence > 80) {
            reasons.push(`Adult content: ${label.Name}`);
            status = ModerationStatus.REJECTED;
          } else if (confidence > 60) {
            reasons.push(`Possible adult content: ${label.Name}`);
            if (status === ModerationStatus.APPROVED) {
              status = ModerationStatus.NEEDS_REVIEW;
            }
          }
        }

        if (this.isViolentContent(name)) {
          scores.violence = Math.max(scores.violence, confidence);
          if (confidence > 80) {
            reasons.push(`Violent content: ${label.Name}`);
            status = ModerationStatus.REJECTED;
          } else if (confidence > 60) {
            reasons.push(`Possible violent content: ${label.Name}`);
            if (status === ModerationStatus.APPROVED) {
              status = ModerationStatus.NEEDS_REVIEW;
            }
          }
        }

        if (this.isSuggestiveContent(name)) {
          scores.racy = Math.max(scores.racy, confidence);
          if (confidence > 70 && status === ModerationStatus.APPROVED) {
            reasons.push(`Suggestive content: ${label.Name}`);
            status = ModerationStatus.NEEDS_REVIEW;
          }
        }
      });

      const confidence = this.calculateConfidence(scores);

      this.logger.log(
        `AWS Rekognition moderation: ${status} (${confidence}%) - ${reasons.join(', ') || 'Clean'}`
      );

      return {
        status,
        confidence,
        reasons,
        scores,
        details: { labels },
        provider: 'AWS_REKOGNITION',
      };
    } catch (error) {
      this.logger.error('AWS Rekognition moderation error:', error.message);
      throw error;
    }
  }

  /**
   * Check if label indicates adult content
   */
  private isAdultContent(label: string): boolean {
    const adultKeywords = ['explicit nudity', 'nudity', 'sexual', 'adult'];
    return adultKeywords.some((keyword) => label.includes(keyword));
  }

  /**
   * Check if label indicates violent content
   */
  private isViolentContent(label: string): boolean {
    const violenceKeywords = ['violence', 'weapon', 'blood', 'gore', 'corpse'];
    return violenceKeywords.some((keyword) => label.includes(keyword));
  }

  /**
   * Check if label indicates suggestive content
   */
  private isSuggestiveContent(label: string): boolean {
    const suggestiveKeywords = ['suggestive', 'revealing', 'partial nudity'];
    return suggestiveKeywords.some((keyword) => label.includes(keyword));
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(scores: { adult: number; violence: number; racy: number }): number {
    const maxRiskScore = Math.max(scores.adult, scores.violence, scores.racy);

    // Invert score: high risk = low confidence in safety
    return Math.round(100 - maxRiskScore);
  }
}
