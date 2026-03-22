import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { MenusService } from './menus.service';
import { CreateMenuDto, UpdateMenuDto, MenuConditionDto, AddMenuItemDto } from './dto/create-menu.dto';

@Controller('bars/:barId/menus')
export class MenusController {
  constructor(private menusService: MenusService) {}

  @Get()
  async findByBar(@Param('barId') barId: string) {
    return this.menusService.findByBar(barId);
  }

  @Get('available')
  async getAvailableMenus(
    @Param('barId') barId: string,
    @Query('userId') userId?: string
  ) {
    return this.menusService.getAvailableMenus(barId, userId);
  }

  @Get(':menuId')
  async findOne(@Param('menuId') menuId: string) {
    return this.menusService.findOne(menuId);
  }

  @Post()
  async create(
    @Param('barId') barId: string,
    @Body() dto: CreateMenuDto
  ) {
    return this.menusService.create(barId, dto);
  }

  @Put(':menuId')
  async update(
    @Param('menuId') menuId: string,
    @Body() dto: UpdateMenuDto
  ) {
    return this.menusService.update(menuId, dto);
  }

  @Delete(':menuId')
  async delete(@Param('menuId') menuId: string) {
    return this.menusService.delete(menuId);
  }

  // ==================== CONDITIONS ====================

  @Post(':menuId/conditions')
  async addCondition(
    @Param('menuId') menuId: string,
    @Body() dto: MenuConditionDto
  ) {
    return this.menusService.addCondition(menuId, dto);
  }

  @Delete('conditions/:conditionId')
  async removeCondition(@Param('conditionId') conditionId: string) {
    return this.menusService.removeCondition(conditionId);
  }

  // ==================== ITEMS ====================

  @Post(':menuId/items')
  async addItem(
    @Param('menuId') menuId: string,
    @Body() dto: AddMenuItemDto
  ) {
    return this.menusService.addItem(menuId, dto);
  }

  @Delete('items/:itemId')
  async removeItem(@Param('itemId') itemId: string) {
    return this.menusService.removeItem(itemId);
  }
}
