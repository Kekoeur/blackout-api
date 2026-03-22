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
import { TagsService } from './tags.service';
import { CreateTagDto, AddTagsToDrinkDto } from './dto/create-tag.dto';

@Controller('tags')
export class TagsController {
  constructor(private tagsService: TagsService) {}

  @Get()
  async findAll() {
    return this.tagsService.findAll();
  }

  @Post()
  async create(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto);
  }

  @Put(':tagId')
  async update(@Param('tagId') tagId: string, @Body() dto: Partial<CreateTagDto>) {
    return this.tagsService.update(tagId, dto);
  }

  @Delete(':tagId')
  async delete(@Param('tagId') tagId: string) {
    return this.tagsService.delete(tagId);
  }

  // ==================== DRINK TAGS ====================

  @Get('drinks/:drinkId')
  async getDrinkTags(@Param('drinkId') drinkId: string) {
    return this.tagsService.getDrinkTags(drinkId);
  }

  @Post('drinks/:drinkId')
  async addTagsToDrink(
    @Param('drinkId') drinkId: string,
    @Body() dto: AddTagsToDrinkDto
  ) {
    return this.tagsService.addTagsToDrink(drinkId, dto.tagIds);
  }

  @Delete('drinks/:drinkId/:tagId')
  async removeTagFromDrink(
    @Param('drinkId') drinkId: string,
    @Param('tagId') tagId: string
  ) {
    return this.tagsService.removeTagFromDrink(drinkId, tagId);
  }

  @Get('filter')
  async getDrinksByTags(@Query('tags') tags: string) {
    const tagIds = tags.split(',').filter(Boolean);
    return this.tagsService.getDrinksByTags(tagIds);
  }
}
