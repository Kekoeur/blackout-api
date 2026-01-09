// apps/client-api/src/bar-management/admin.controller.ts

import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  UseGuards,
  Patch,
} from '@nestjs/common';
import { BarDashboardAuthGuard } from './guards/bar-dashboard-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(BarDashboardAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // =============== GESTION DES BARS ===============
  
  @Get('bars')
  async getAllBars() {
    return this.adminService.getAllBars();
  }

  @Patch('bars/:barId/toggle-active')
  async toggleBarActive(@Param('barId') barId: string) {
    return this.adminService.toggleBarActive(barId);
  }

  @Delete('bars/:barId')
  async deleteBar(@Param('barId') barId: string) {
    return this.adminService.deleteBar(barId);
  }

  // =============== GESTION DES UTILISATEURS ===============

  @Get('users')
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Post('users/create-owner')
  async createOwner(@Body() body: { email: string; name: string; password: string }) {
    return this.adminService.createOwner(body.email, body.name, body.password);
  }

  @Delete('users/:userId')
  async deleteUser(@Param('userId') userId: string) {
    return this.adminService.deleteUser(userId);
  }

  @Post('users/:userId/reset-password')
  async sendPasswordResetEmail(@Param('userId') userId: string) {
    return this.adminService.sendPasswordResetEmail(userId);
  }

  @Put('users/:userId')
  async updateUser(
    @Param('userId') userId: string,
    @Body() body: { name?: string; email?: string },
  ) {
    return this.adminService.updateUser(userId, body);
  }
  @Post('users/:userId/promote-owner')
  async promoteToOwner(
    @Param('userId') userId: string,
    @Body() body: { barId: string },
  ) {
    return this.adminService.promoteToOwner(userId, body.barId);
  }

  // =============== STATISTIQUES GLOBALES ===============

  @Get('stats')
  async getGlobalStats() {
    return this.adminService.getGlobalStats();
  }
}