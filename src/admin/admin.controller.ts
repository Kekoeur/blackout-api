import { Controller, Get, Delete, Param, Query, UseGuards, Post, Body } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminDashboardAuthGuard } from '../auth/guards/admin-dashboard-auth.guard';
import { AuthService } from '../auth/auth.service';

@Controller('admin')
@UseGuards(AdminDashboardAuthGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  // ===== COMMANDES =====

  @Get('orders')
  async getAllOrders(@Query('status') status?: string) {
    return this.adminService.getAllOrders(status);
  }

  @Delete('orders/:orderId')
  async deleteOrder(@Param('orderId') orderId: string) {
    return this.adminService.deleteOrder(orderId);
  }

  @Delete('orders')
  async deleteAllOrders() {
    return this.adminService.deleteAllOrders();
  }

  // ===== PHOTO VALIDATIONS =====

  @Get('photo-submissions')
  async getAllPhotoSubmissions(@Query('status') status?: string) {
    return this.adminService.getAllPhotoSubmissions(status);
  }

  @Delete('photo-submissions/:submissionId')
  async deletePhotoSubmission(@Param('submissionId') submissionId: string) {
    return this.adminService.deletePhotoSubmission(submissionId);
  }

  @Delete('photo-submissions')
  async deleteAllPhotoSubmissions() {
    return this.adminService.deleteAllPhotoSubmissions();
  }

  // ===== CLEANUP HELPERS =====

  @Post('cleanup/test-data')
  async cleanupTestData() {
    return this.adminService.cleanupTestData();
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

  @Post('mobile-users/:userId/send-password-reset')
  async sendPasswordResetEmail(@Param('userId') userId: string) {
    return this.authService.sendPasswordResetForUser(userId);
  }

  @Post('mobile-users/:userId/reset-nsfw-flag')
  async resetUserNsfwFlag(@Param('userId') userId: string) {
    return this.adminService.resetUserNsfwFlag(userId);
  }

  // ===== PLACEHOLDER ROUTES (Frontend expects these) =====

  @Get('api-logs')
  async getApiLogs() {
    // TODO: Implement logging system
    // For now, return empty array to prevent 404 errors
    return [];
  }

  @Get('api-users')
  async getApiUsers() {
    // TODO: Implement API key management system
    // For now, return empty array to prevent 404 errors
    return [];
  }

  @Get('guests')
  async getGuests() {
    // Note: "Guests" are called "Friends" in this system
    // Return friends data in guest format
    return this.adminService.getAllFriends();
  }

  @Delete('guests/:guestId')
  async deleteGuest(@Param('guestId') guestId: string) {
    return this.adminService.deleteFriend(guestId);
  }

  // ===== BAR USERS =====

  @Get('bar-users')
  async getAllBarUsers() {
    return this.adminService.getAllBarUsers();
  }

  @Post('bar-users')
  async createBarUser(
    @Body() body: { email: string; password: string; name: string; barId?: string; role?: string },
  ) {
    return this.adminService.createBarUser(body);
  }

  @Delete('bar-users/:userId')
  async deleteBarUser(@Param('userId') userId: string) {
    return this.adminService.deleteBarUser(userId);
  }

  // ===== BARS =====

  @Get('bars')
  async getAllBars() {
    return this.adminService.getAllBars();
  }

  @Delete('bars/:barId')
  async deleteBar(@Param('barId') barId: string) {
    return this.adminService.deleteBar(barId);
  }
}