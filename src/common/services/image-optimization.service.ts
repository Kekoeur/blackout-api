import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Image optimization service using Sharp.
 * Automatically resizes and converts images to WebP format.
 */
@Injectable()
export class ImageOptimizationService {
  private readonly logger = new Logger(ImageOptimizationService.name);
  private readonly enabled: boolean;
  private readonly maxDimension: number;
  private readonly webpQuality: number;

  constructor() {
    this.enabled = process.env.IMAGE_AUTO_OPTIMIZE !== 'false';
    this.maxDimension = parseInt(process.env.IMAGE_MAX_DIMENSION || '1200', 10);
    this.webpQuality = parseInt(process.env.IMAGE_WEBP_QUALITY || '80', 10);

    if (this.enabled) {
      this.logger.log(
        `Image optimization enabled: max ${this.maxDimension}px, WebP quality ${this.webpQuality}%`
      );
    } else {
      this.logger.log('Image optimization disabled');
    }
  }

  /**
   * Optimize image buffer
   * @param buffer - Original image buffer
   * @param options - Optional override options
   * @returns Optimized image buffer in WebP format
   */
  async optimizeImage(
    buffer: Buffer,
    options?: {
      maxDimension?: number;
      quality?: number;
      format?: 'webp' | 'jpeg' | 'png';
    }
  ): Promise<Buffer> {
    if (!this.enabled) {
      return buffer;
    }

    try {
      const maxDim = options?.maxDimension || this.maxDimension;
      const quality = options?.quality || this.webpQuality;
      const format = options?.format || 'webp';

      const image = sharp(buffer);
      const metadata = await image.metadata();

      this.logger.log(
        `Optimizing image: ${metadata.width}x${metadata.height} ${metadata.format} -> ${maxDim}px ${format}`
      );

      let optimized = image.resize(maxDim, maxDim, {
        fit: 'inside',
        withoutEnlargement: true,
      });

      // Convert to specified format
      switch (format) {
        case 'webp':
          optimized = optimized.webp({ quality });
          break;
        case 'jpeg':
          optimized = optimized.jpeg({ quality, mozjpeg: true });
          break;
        case 'png':
          optimized = optimized.png({ quality, compressionLevel: 9 });
          break;
      }

      const result = await optimized.toBuffer();

      const originalSize = buffer.length;
      const newSize = result.length;
      const savings = ((1 - newSize / originalSize) * 100).toFixed(1);

      this.logger.log(
        `Image optimized: ${(originalSize / 1024).toFixed(1)}KB -> ${(newSize / 1024).toFixed(1)}KB (${savings}% reduction)`
      );

      return result;
    } catch (error) {
      this.logger.error('Image optimization failed:', error.message);
      // Return original if optimization fails
      return buffer;
    }
  }

  /**
   * Generate thumbnail
   * @param buffer - Original image buffer
   * @param size - Thumbnail size (default: 200px)
   * @returns Thumbnail buffer
   */
  async generateThumbnail(buffer: Buffer, size: number = 200): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 70 })
        .toBuffer();
    } catch (error) {
      this.logger.error('Thumbnail generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get image metadata
   * @param buffer - Image buffer
   * @returns Image metadata
   */
  async getMetadata(buffer: Buffer) {
    try {
      return await sharp(buffer).metadata();
    } catch (error) {
      this.logger.error('Failed to read image metadata:', error.message);
      throw error;
    }
  }

  /**
   * Validate image
   * @param buffer - Image buffer
   * @returns true if valid image
   */
  async isValidImage(buffer: Buffer): Promise<boolean> {
    try {
      await sharp(buffer).metadata();
      return true;
    } catch (error) {
      return false;
    }
  }
}
