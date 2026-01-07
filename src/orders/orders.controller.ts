import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Query,
  Patch,
  UseInterceptors,
  UploadedFile,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PhotoMetadataDto } from './dto/photo-metadata.dto';

@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: any, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, dto.barId, dto.drinkIds, dto.assignments);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async findMyOrders(@CurrentUser() user: any) {
    return this.orders.findMyOrders(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@CurrentUser() user: any, @Param('id') orderId: string) {
    return this.orders.findOne(orderId, user.id);
  }

  @Get('my/history')
  @UseGuards(JwtAuthGuard)
  async getMyHistory(@CurrentUser() user: any) {
    return this.orders.findMyValidatedOrders(user.id);
  }

  @Get('my/assigned')
  @UseGuards(JwtAuthGuard)
  async getMyAssignedOrders(@CurrentUser() user: any) {
    return this.orders.findMyAssignedOrders(user.id);
  }

  // ⭐ ENDPOINT BAR : Valider commande
  @Post(':id/validate')
  async validate(
    @Param('id') orderId: string,
    @Headers('x-api-key') apiKey: string,
  ) {
    return this.orders.validate(orderId, apiKey);
  }

  // ⭐ ENDPOINT BAR : Annuler commande
  @Post(':id/cancel')
  async cancel(
    @Param('id') orderId: string,
    @Headers('x-api-key') apiKey: string,
  ) {
    return this.orders.cancel(orderId, apiKey);
  }

  @Get('bar/:barId')
  async getBarOrders(
    @Param('barId') barId: string,
    @Query('status') status?: string,
  ) {
    return this.orders.getBarOrders(barId, status);
  }

  @Patch(':orderId/validate')
  async validateOrder(@Param('orderId') orderId: string) {
    return this.orders.validateOrder(orderId);
  }

  @Patch(':orderId/cancel')
  async cancelOrder(@Param('orderId') orderId: string) {
    return this.orders.cancelOrder(orderId);
  }
}