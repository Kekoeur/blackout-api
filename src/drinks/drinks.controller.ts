import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentBarUser } from 'src/bar-management/decorators/current-bar-user.decorator';
import { DrinksService } from './drinks.service';
import { BarDashboardAuthGuard } from 'src/bar-management/guards/bar-dashboard-auth.guard';

@Controller('drinks')
export class DrinksController {
  constructor(private drinks: DrinksService) {}

  @Get()
  async findAll(@Query('userId') userId?: string) {
    return this.drinks.findAll(userId);
  }

  @Get('bar/:barId')
  async findByBar(
    @Param('barId') barId: string,
    @Query('userId') userId?: string,
  ) {
    return this.drinks.findByBar(barId, userId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ) {
    return this.drinks.findOne(id, userId);
  }

  @Get('menu/:barId')
  @UseGuards(BarDashboardAuthGuard)
  async getBarMenu(@Param('barId') barId: string) {
    return this.drinks.getBarMenu(barId);
  }

  @Get('catalog/all')
  @UseGuards(BarDashboardAuthGuard)
  async getAllDrinks(
    @CurrentBarUser() user: any,
    @Query('barId') barId?: string, // ⭐ barId obligatoire
  ) {
    if (!barId) {
      return this.drinks.getAllDrinksForUser(user.id);
    }

    return this.drinks.getAllDrinksForSelection(user.id, barId);
  }

  @Put('catalog/:drinkId')
  @UseGuards(BarDashboardAuthGuard)
  async updateDrink(
    @CurrentBarUser() user: any,
    @Param('drinkId') drinkId: string,
    @Body() body: {
      name?: string;
      type?: 'SHOOTER' | 'COCKTAIL';
      alcoholLevel?: number;
      ingredients?: string[];
      description?: string;
      imageUrl?: string;
    },
  ) {
    return this.drinks.updateDrink(user.id, drinkId, body);
  }

  @Post('menu/:barId')
  @UseGuards(BarDashboardAuthGuard)
  async addDrinkToMenu(
    @Param('barId') barId: string,
    @Body() body: { drinkId: string; price: number },
  ) {
    return this.drinks.addDrinkToMenu(barId, body.drinkId, body.price);
  }

  @Put('menu/:barId/:drinkId')
  @UseGuards(BarDashboardAuthGuard)
  async updateMenuDrink(
    @Param('barId') barId: string,
    @Param('drinkId') drinkId: string,
    @Body() body: { price?: number; available?: boolean },
  ) {
    return this.drinks.updateMenuDrink(barId, drinkId, body);
  }

  @Delete('menu/:barId/:drinkId')
  @UseGuards(BarDashboardAuthGuard)
  async removeDrinkFromMenu(
    @Param('barId') barId: string,
    @Param('drinkId') drinkId: string,
  ) {
    return this.drinks.removeDrinkFromMenu(barId, drinkId);
  }

  @Post('catalog')
  @UseGuards(BarDashboardAuthGuard)
  async createDrink(@CurrentBarUser() barUser: any, @Body() body: {
    barId: string;
    name: string;
    type: 'SHOOTER' | 'COCKTAIL';
    alcoholLevel?: number;
    ingredients?: string[];
    description?: string;
    imageUrl: string;
    isPublic?: boolean;
  }) {
    return this.drinks.createDrink(barUser.id, body.barId, body);
  }

  @Delete('catalog/:id')
  @UseGuards(BarDashboardAuthGuard)
  async deleteDrink(@Param('id') id: string) {
    return this.drinks.deleteDrink(id);
  }
}
