import { 
  Controller, 
  Get, 
  Post,
  Put,
  Delete, 
  Body, 
  UseGuards, 
  Res,
  Param,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { Response } from 'express';
import * as QRCode from 'qrcode';


@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return this.users.findOne(user.id);
  }

  @Get('me/qrcode')
  async getMyQRCode(@CurrentUser() user: any, @Res() res: Response) {
    const userData = await this.users.findOne(user.id);
    
    // ⭐ AJOUTER VÉRIFICATION NULL
    if (!userData) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ⭐ VÉRIFIER QUE friendCode EXISTE
    if (!userData.friendCode) {
      return res.status(400).json({ message: 'Friend code not generated yet' });
    }
    
    const qrData = JSON.stringify({
      type: 'friend',
      friendCode: userData.friendCode,
      username: userData.username,
    });

    const qrCodeImage = await QRCode.toDataURL(qrData, {
      width: 400,
      margin: 2,
    });

    res.json({
      friendCode: userData.friendCode,
      username: userData.username,
      qrCode: qrCodeImage,
    });
  }

  @Get('me/stats')
  async getMyStats(@CurrentUser() user: any) {
    return this.users.getUserStats(user.id);
  }

  @Put('me')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() data: { username?: string; bio?: string },
  ) {
    return this.users.updateProfile(user.id, data);
  }

  @Post('me/link-friend')
  async linkFriend(
    @CurrentUser() user: any,
    @Body() body: { friendId: string; targetFriendCode: string },
  ) {
    return this.users.linkFriend(user.id, body.friendId, body.targetFriendCode);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: './uploads/avatars',
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
  async uploadAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.users.updateAvatar(user.id, file.path);
  }

  @Post('me/change-password')
  async changePassword(
    @CurrentUser() user: any,
    @Body() data: { currentPassword: string; newPassword: string },
  ) {
    return this.users.changePassword(user.id, data.currentPassword, data.newPassword);
  }

  @Delete('me')
  async deleteAccount(
    @CurrentUser() user: any,
    @Body() data: { password: string },
  ) {
    return this.users.deleteAccount(user.id, data.password);
  }
}