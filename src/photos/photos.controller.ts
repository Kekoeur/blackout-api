import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PhotosService } from './photos.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { BarDashboardAuthGuard } from 'src/bar-management/guards/bar-dashboard-auth.guard';

@Controller('photos')
// ⭐ ENLEVER le guard d'ici
export class PhotosController {
  constructor(private photos: PhotosService) {}

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads/photos',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async submitPhoto(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    const { barId, items } = body;
    
    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

    return this.photos.submitPhoto(
      user.id,
      barId,
      file.path,
      parsedItems,
    );
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMySubmissions(@CurrentUser() user: any) {
    return this.photos.getMySubmissions(user.id);
  }

  @Post(':id/validate')
  async validate(
    @Param('id') submissionId: string,
    @Headers('x-api-key') apiKey: string,
  ) {
    return this.photos.validateSubmission(submissionId, apiKey);
  }

  @Post(':id/reject')
  async reject(
    @Param('id') submissionId: string,
    @Headers('x-api-key') apiKey: string,
  ) {
    return this.photos.rejectSubmission(submissionId, apiKey);
  }

  @Get('bar/:barId')
  @UseGuards(BarDashboardAuthGuard)
  async getBarPhotos(
    @Param('barId') barId: string,
    @Query('status') status?: string,
  ) {
    return this.photos.getBarPhotos(barId, status);
  }

  @Post(':photoId/validate-dashboard')
  @UseGuards(BarDashboardAuthGuard)
  async validatePhotoFromDashboard(
    @Param('photoId') photoId: string,
    @Body() body: { barId: string },
  ) {
    return this.photos.validateSubmissionByDashboard(photoId, body.barId);
  }

  @Post(':photoId/reject-dashboard')
  @UseGuards(BarDashboardAuthGuard)
  async rejectPhotoFromDashboard(
    @Param('photoId') photoId: string,
    @Body() body: { barId: string; reason?: string; comment?: string },
  ) {
    return this.photos.rejectSubmissionByDashboard(photoId, body.barId, body.reason, body.comment);
  }
}