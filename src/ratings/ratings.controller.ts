import { Controller, Post, Put, Get, Body, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(private ratings: RatingsService) {}

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateRatingDto) {
    return this.ratings.rateAllDrinkConsumptions(
      user.id,
      dto.drinkId,
      dto.stars,
      dto.comment,
    );
  }

  @Put(':drinkId')
  async update(
    @CurrentUser() user: any,
    @Param('drinkId') drinkId: string,
    @Body() dto: { stars: number; comment?: string },
  ) {
    return this.ratings.updateRating(user.id, drinkId, dto.stars, dto.comment);
  }

  @Get('my')
  async getMyRatings(@CurrentUser() user: any) {
    return this.ratings.getMyRatings(user.id);
  }

  @Get('drink/:drinkId')
  async getRatingForDrink(
    @CurrentUser() user: any,
    @Param('drinkId') drinkId: string,
  ) {
    return this.ratings.getRatingForDrink(user.id, drinkId);
  }
}