// apps/client-api/src/bar-management/bar-management.controller.ts

import { Controller, Post, Get, Patch, Delete, Body, UseGuards, Param } from '@nestjs/common';
import { BarManagementService } from './bar-management.service';
import { BarDashboardAuthGuard } from './guards/bar-dashboard-auth.guard';
import { CurrentBarUser } from './decorators/current-bar-user.decorator';
import { InvitationService } from './invitation.service';

@Controller('bar-management')
export class BarManagementController {
  constructor(
    private barManagement: BarManagementService,
    private invitationService: InvitationService,
  ) {}

  @Post('auth/login')
  async login(@Body() body: { email: string; password: string }) {
    console.log("body", body)
    return this.barManagement.login(body.email, body.password);
  }

  @Post('auth/register')
  async register(@Body() body: {
    token: string;
    password: string;
    name: string;
  }) {
    return this.barManagement.registerWithInvitation(
      body.token,
      body.name,
      body.password,
    );
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

  @Get('bars/:barId')
  @UseGuards(BarDashboardAuthGuard)
  async getBarDetails(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
  ) {
    return this.barManagement.getBarDetails(user.id, barId);
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
  async createInvitation(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
    @Body() body: { email: string; role: 'VIEWER' | 'STAFF' | 'MANAGER' },
  ) {
    return this.invitationService.createInvitation(
      user.id,
      barId,
      body.email,
      body.role,
    );
  }

  @Post('bars/:barId/users/create')
  @UseGuards(BarDashboardAuthGuard)
  async createUserDirectly(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
    @Body() body: {
      email: string;
      name: string;
      password: string;
      role: 'VIEWER' | 'STAFF' | 'MANAGER';
    },
  ) {
    return this.invitationService.createUserDirectly(user.id, barId, body);
  }

  @Get('invitations/verify/:token')
  async verifyInvitation(@Param('token') token: string) {
    return this.invitationService.verifyInvitation(token);
  }

  @Get('bars/:barId/members')
  @UseGuards(BarDashboardAuthGuard)
  async getBarMembers(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
  ) {
    return this.barManagement.getBarMembers(user.id, barId);
  }

  @Get('bars/:barId/invitations')
  @UseGuards(BarDashboardAuthGuard)
  async getBarInvitations(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
  ) {
    return this.barManagement.getBarInvitations(user.id, barId);
  }

  @Delete('bars/:barId/members/:userId')
  @UseGuards(BarDashboardAuthGuard)
  async removeMember(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
    @Param('userId') userId: string,
  ) {
    return this.barManagement.removeMember(user.id, barId, userId);
  }

  @Get('bars/:barId/team')
  @UseGuards(BarDashboardAuthGuard)
  async getBarTeam(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
  ) {
    // Vérifier que l'user a accès au bar
    await this.barManagement.checkPermission(user.id, barId, 'VIEWER');
    
    return this.barManagement.getBarTeam(barId);
  }

  @Patch('bars/:barId/users/:userId/role')
  @UseGuards(BarDashboardAuthGuard)
  async changeUserRole(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
    @Param('userId') userId: string,
    @Body() body: { role: 'VIEWER' | 'STAFF' | 'MANAGER' },
  ) {
    // Vérifier que l'user est OWNER
    await this.barManagement.checkPermission(user.id, barId, 'OWNER');
    
    return this.barManagement.changeUserRole(userId, barId, body.role);
  }

  @Delete('bars/:barId/users/:userId')
  @UseGuards(BarDashboardAuthGuard)
  async removeUserFromBar(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
    @Param('userId') userId: string,
  ) {
    // Vérifier que l'user est OWNER
    await this.barManagement.checkPermission(user.id, barId, 'OWNER');
    
    return this.barManagement.removeUserFromBar(userId, barId);
  }

  @Post('auth/reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.barManagement.resetPassword(body.token, body.password);
  }

  @Patch('bars/:barId/activate')
  @UseGuards(BarDashboardAuthGuard)
  async activateBar(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
  ) {
    return this.barManagement.activateBar(user.id, barId);
  }

  @Patch('bars/:barId/deactivate')
  @UseGuards(BarDashboardAuthGuard)
  async deactivateBar(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
  ) {
    return this.barManagement.deactivateBar(user.id, barId);
  }

  @Patch('bars/:barId/geocode')
  @UseGuards(BarDashboardAuthGuard)
  async geocodeBar(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
  ) {
    return this.barManagement.geocodeBar(user.id, barId);
  }

  @Patch('bars/:barId/coordinates')
  @UseGuards(BarDashboardAuthGuard)
  async updateCoordinates(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
    @Body() body: { latitude: number; longitude: number },
  ) {
    return this.barManagement.updateCoordinates(user.id, barId, body.latitude, body.longitude);
  }

  @Patch('bars/:barId/address')
  @UseGuards(BarDashboardAuthGuard)
  async updateBarAddress(
    @CurrentBarUser() user: any,
    @Param('barId') barId: string,
    @Body() body: { address: string; city: string; postalCode?: string },
  ) {
    return this.barManagement.updateBarAddress(user.id, barId, body);
}
}