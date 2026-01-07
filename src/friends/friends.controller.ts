import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private friends: FriendsService) {}

  @Get()
  async getMyFriends(@CurrentUser() user: any) {
    return this.friends.getMyFriends(user.id);
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: { name: string }) {
    return this.friends.createFriend(user.id, dto.name);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: any, @Param('id') friendId: string) {
    return this.friends.deleteFriend(user.id, friendId);
  }

  @Post('assign')
  async assignOrderItem(
    @CurrentUser() user: any,
    @Body() dto: { orderItemId: string; friendId?: string },
  ) {
    return this.friends.assignOrderItem(
      user.id,
      dto.orderItemId,
      dto.friendId || null,
    );
  }
}