import { Controller, Get, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard'; // À créer

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ===== COMMANDES =====
  
  @Get('orders')
  async getAllOrders(@Query('status') status?: string) {
    return this.adminService.getAllOrders(status);
  }
  
  @Delete('orders/:orderId')
  async deleteOrder(@Param('orderId') orderId: string) {
    return this.adminService.deleteOrder(orderId);
  }
  
  // ===== UTILISATEURS MOBILE =====
  
  @Get('mobile-users')
  async getAllMobileUsers() {
    return this.adminService.getAllMobileUsers();
  }
  
  @Delete('mobile-users/:userId')
  async deleteMobileUser(@Param('userId') userId: string) {
    return this.adminService.deleteMobileUser(userId);
  }
}