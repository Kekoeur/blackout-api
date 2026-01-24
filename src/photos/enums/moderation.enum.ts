/**
 * Photo moderation status
 */
export enum ModerationStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
}

/**
 * Available moderation providers
 */
export enum ModerationProvider {
  GOOGLE_VISION = 'GOOGLE_VISION',
  AWS_REKOGNITION = 'AWS_REKOGNITION',
  NSFWJS = 'NSFWJS',
}

/**
 * Risk levels for content detection
 */
export enum RiskLevel {
  VERY_UNLIKELY = 'VERY_UNLIKELY',
  UNLIKELY = 'UNLIKELY',
  POSSIBLE = 'POSSIBLE',
  LIKELY = 'LIKELY',
  VERY_LIKELY = 'VERY_LIKELY',
}
