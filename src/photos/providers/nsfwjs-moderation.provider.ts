import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nsfwjs from 'nsfwjs';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import { ModerationResult, NSFWPrediction } from '../interfaces/moderation.interface';
import { ModerationStatus } from '../enums/moderation.enum';
import axios from 'axios';
import { createCanvas, loadImage } from 'canvas';
import * as path from 'path';
import * as fs from 'fs';

/**
 * NSFW.js moderation provider (Open Source).
 * Uses TensorFlow.js model to detect inappropriate content.
 *
 * Setup:
 * No API keys needed - works offline!
 * Set NSFWJS_MODERATION_ENABLED=true to enable
 *
 * Note: Less accurate than Google/AWS but free and private
 * Uses pure JavaScript TensorFlow (@tensorflow/tfjs) instead of native bindings
 */
@Injectable()
export class NSFWJSModerationProvider implements OnModuleInit {
  private readonly logger = new Logger(NSFWJSModerationProvider.name);
  private model: nsfwjs.NSFWJS;
  private enabled: boolean;
  private modelLoaded: boolean = false;

  constructor() {
    this.enabled = process.env.NSFWJS_MODERATION_ENABLED === 'true';
    this.logger.log(`NSFWJS constructor: enabled=${this.enabled} (env=${process.env.NSFWJS_MODERATION_ENABLED})`);
  }

  /**
   * Load the NSFW model on module initialization
   */
  async onModuleInit() {
    if (this.enabled) {
      try {
        this.logger.log('Loading NSFW.js model (this may take a minute on first run)...');

        // Set TensorFlow backend to CPU
        await tf.setBackend('cpu');
        await tf.ready();

        this.model = await nsfwjs.load();
        this.modelLoaded = true;
        this.logger.log('NSFW.js moderation provider initialized successfully');
      } catch (error) {
        this.logger.error('Failed to load NSFW.js model:', error.message);
        this.enabled = false;
      }
    } else {
      this.logger.log('NSFW.js moderation provider is disabled');
    }
  }

  /**
   * Check if provider is enabled and ready
   */
  isEnabled(): boolean {
    return this.enabled && this.modelLoaded;
  }

  /**
   * Moderate image using NSFW.js
   * @param imageUrl - URL of the image to moderate
   * @returns Moderation result with predictions
   */
  async moderateImage(imageUrl: string): Promise<ModerationResult> {
    if (!this.isEnabled()) {
      throw new Error('NSFW.js moderation provider is not enabled or model not loaded');
    }

    try {
      // Convert relative path to absolute if needed
      let imagePath = imageUrl;
      if (!imageUrl.startsWith('http') && !path.isAbsolute(imageUrl)) {
        imagePath = path.resolve(process.cwd(), imageUrl);
        this.logger.log(`Resolved image path: ${imagePath}`);
      }

      // Verify file exists for local paths
      if (!imageUrl.startsWith('http') && !fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      // Load image using canvas
      const img = await loadImage(imagePath);

      // Create canvas element from loaded image
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Get predictions using canvas element (cast to any to bypass type checking)
      const predictions = (await this.model.classify(canvas as any)) as NSFWPrediction[];

      // Extract scores
      const pornScore = predictions.find((p) => p.className === 'Porn')?.probability || 0;
      const hentaiScore = predictions.find((p) => p.className === 'Hentai')?.probability || 0;
      const sexyScore = predictions.find((p) => p.className === 'Sexy')?.probability || 0;
      const drawingScore = predictions.find((p) => p.className === 'Drawing')?.probability || 0;
      const neutralScore = predictions.find((p) => p.className === 'Neutral')?.probability || 0;

      // Calculate combined adult score
      const adultScore = (pornScore + hentaiScore) * 100;
      const racyScore = sexyScore * 100;

      const reasons: string[] = [];
      let status = ModerationStatus.APPROVED;

      // Thresholds (lowered to catch "photo of photo" scenarios)
      const ADULT_REJECT_THRESHOLD = 15; // 15% - rejet direct
      const ADULT_REVIEW_THRESHOLD = 5;  // 5% - revue manuelle
      const RACY_REVIEW_THRESHOLD = 20;  // 20% - contenu suggestif

      if (adultScore > ADULT_REJECT_THRESHOLD) {
        reasons.push(`Explicit content detected (${adultScore.toFixed(1)}%)`);
        status = ModerationStatus.REJECTED;
      } else if (adultScore > ADULT_REVIEW_THRESHOLD) {
        reasons.push(`Possible explicit content (${adultScore.toFixed(1)}%)`);
        status = ModerationStatus.NEEDS_REVIEW;
      }

      if (racyScore > RACY_REVIEW_THRESHOLD && status === ModerationStatus.APPROVED) {
        reasons.push(`Suggestive content detected (${racyScore.toFixed(1)}%)`);
        status = ModerationStatus.NEEDS_REVIEW;
      }

      // Confidence is inverse of risk
      const confidence = Math.round(
        Math.max(0, 100 - Math.max(adultScore, racyScore))
      );

      this.logger.log(
        `NSFW.js moderation: ${status} (${confidence}%) - Adult: ${adultScore.toFixed(1)}%, Racy: ${racyScore.toFixed(1)}%`
      );

      return {
        status,
        confidence,
        reasons,
        scores: {
          adult: adultScore,
          racy: racyScore,
        },
        details: {
          predictions: predictions.map((p) => ({
            class: p.className,
            probability: (p.probability * 100).toFixed(2) + '%',
          })),
        },
        provider: 'NSFWJS',
      };
    } catch (error) {
      this.logger.error('NSFW.js moderation error:', error.message);
      throw error;
    }
  }
}
