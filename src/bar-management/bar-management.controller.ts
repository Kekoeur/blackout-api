// apps/client-api/src/bar-management/bar-management.controller.ts

import { Controller, Post, Get, Body, UseGuards, Param } from '@nestjs/common';
import { BarManagementService } from './bar-management.service';
import { BarDashboardAuthGuard } from './guards/bar-dashboard-auth.guard';
import { CurrentBarUser } from './decorators/current-bar-user.decorator';

@Controller('bar-management')
export class BarManagementController {
  constructor(private barManagement: BarManagementService) {}

  @Post('auth/login')
  async login(@Body() body: { email: string; password: string }) {
    return this.barManagement.login(body.email, body.password);
  }

  @Post('auth/register')
  async register(@Body() body: { email: string; password: string; name: string }) {
    return this.barManagement.register(body.email, body.password, body.name);
  }

  @Post('bars')
  @UseGuards(BarDashboardAuthGuard)
  async createBar(
    @CurrentBarUser() user: any,
    @Body() body: { name: string; city: string; address: string },
  ) {
    return this.barManagement.createBar(user.id, body);
  }

  @Get('bars')
  @UseGuards(BarDashboardAuthGuard)
  async getMyBars(@CurrentBarUser() user: any) {
    return this.barManagement.getMyBars(user.id);
  }

  @Get('bars/:barId/stats')
  @UseGuards(BarDashboardAuthGuard)
  async getBarStats(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
  ) {
    return this.barManagement.getBarStats(user.id, barId);
  }

  @Post('bars/:barId/invite')
  @UseGuards(BarDashboardAuthGuard)
  async inviteUser(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
    @Body() body: { email: string; role: string },
  ) {
    return this.barManagement.inviteUser(user.id, barId, body.email, body.role);
  }
}