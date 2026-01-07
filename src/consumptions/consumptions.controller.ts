import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ConsumptionsService } from './consumptions.service';

@Controller('consumptions')
@UseGuards(JwtAuthGuard)
export class ConsumptionsController {
  constructor(private consumptions: ConsumptionsService) {}

  @Get('my')
  async findMyConsumptions(@CurrentUser() user: any) {
    console.log('🔍 GET /consumptions/my - userId:', user.id);
    return this.consumptions.findMyConsumptions(user.id);
  }

  @Get('my/bar')
  async findByBar(
    @CurrentUser() user: any,
    @Query('barId') barId: string,
  ) {
    return this.consumptions.findByBar(user.id, barId);
  }

  @Get('my/stats')
  async getStats(@CurrentUser() user: any) {
    return this.consumptions.getStats(user.id);
  }
}
