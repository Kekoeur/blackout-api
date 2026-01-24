import { ModerationStatus, RiskLevel } from '../enums/moderation.enum';

/**
 * Result of photo moderation
 */
export interface ModerationResult {
  /**
   * Overall moderation status
   */
  status: ModerationStatus;

  /**
   * Confidence score (0-100)
   */
  confidence: number;

  /**
   * Reasons for rejection or review
   */
  reasons: string[];

  /**
   * Detailed scores by category
   */
  scores: {
    adult?: number;
    violence?: number;
    racy?: number;
    medical?: number;
  };

  /**
   * Raw provider response (for debugging)
   */
  details?: any;

  /**
   * Provider used for moderation
   */
  provider: string;
}

/**
 * Google Vision API detection result
 */
export interface GoogleVisionDetection {
  adult: RiskLevel;
  violence: RiskLevel;
  racy: RiskLevel;
  medical: RiskLevel;
  spoof: RiskLevel;
}

/**
 * AWS Rekognition moderation label
 */
export interface RekognitionLabel {
  Name: string;
  Confidence: number;
  ParentName?: string;
}

/**
 * NSFW.js prediction result
 */
export interface NSFWPrediction {
  className: 'Drawing' | 'Hentai' | 'Neutral' | 'Porn' | 'Sexy';
  probability: number;
}
