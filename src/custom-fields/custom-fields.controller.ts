import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto, UpdateCustomFieldDto } from './dto/create-custom-field.dto';

@Controller('bars/:barId/custom-fields')
export class CustomFieldsController {
  constructor(private customFieldsService: CustomFieldsService) {}

  @Get()
  async findByBar(@Param('barId') barId: string) {
    return this.customFieldsService.findByBar(barId);
  }

  @Post()
  async create(
    @Param('barId') barId: string,
    @Body() dto: CreateCustomFieldDto
  ) {
    return this.customFieldsService.create(barId, dto);
  }

  @Put(':fieldId')
  async update(
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateCustomFieldDto
  ) {
    return this.customFieldsService.update(fieldId, dto);
  }

  @Delete(':fieldId')
  async delete(@Param('fieldId') fieldId: string) {
    return this.customFieldsService.delete(fieldId);
  }

  @Post('reorder')
  async reorder(
    @Param('barId') barId: string,
    @Body() body: { fieldIds: string[] }
  ) {
    return this.customFieldsService.reorder(barId, body.fieldIds);
  }
}
