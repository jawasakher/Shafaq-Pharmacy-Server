import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalIdentityGuard } from '../identity/internal-identity.guard.js';
import { RolesGuard } from '../identity/roles.guard.js';
import { Roles } from '../identity/roles.decorator.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(InternalIdentityGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  async getOverview() {
    return this.adminService.getOverview();
  }

  @Get('users')
  async listUsers() {
    return this.adminService.listUsers();
  }

  @Get('pharmacies')
  async listPharmacies() {
    return this.adminService.listPharmacies();
  }

  @Get('drivers')
  async listDrivers() {
    return this.adminService.listDrivers();
  }

  @Get('orders')
  async listOrders() {
    return this.adminService.listOrders();
  }

  @Get('audit-logs')
  async listAuditLogs() {
    return this.adminService.listAuditLogs();
  }

  @Post('pharmacies/:id/approve')
  async approvePharmacy(
    @Headers('x-user-id') adminUserId: string,
    @Param('id') pharmacyId: string,
  ) {
    return this.adminService.approvePharmacy(adminUserId, pharmacyId);
  }

  @Post('pharmacies/:id/reject')
  async rejectPharmacy(
    @Headers('x-user-id') adminUserId: string,
    @Param('id') pharmacyId: string,
  ) {
    return this.adminService.rejectPharmacy(adminUserId, pharmacyId);
  }

  @Post('pharmacies/:id/suspend')
  async suspendPharmacy(
    @Headers('x-user-id') adminUserId: string,
    @Param('id') pharmacyId: string,
  ) {
    return this.adminService.suspendPharmacy(adminUserId, pharmacyId);
  }

  @Post('drivers/:id/approve')
  async approveDriver(
    @Headers('x-user-id') adminUserId: string,
    @Param('id') driverId: string,
  ) {
    return this.adminService.approveDriver(adminUserId, driverId);
  }

  @Post('drivers/:id/reject')
  async rejectDriver(
    @Headers('x-user-id') adminUserId: string,
    @Param('id') driverId: string,
  ) {
    return this.adminService.rejectDriver(adminUserId, driverId);
  }

  @Post('drivers/:id/suspend')
  async suspendDriver(
    @Headers('x-user-id') adminUserId: string,
    @Param('id') driverId: string,
  ) {
    return this.adminService.suspendDriver(adminUserId, driverId);
  }

  @Post('orders/:id/resolve-exception')
  async resolveException(
    @Headers('x-user-id') adminUserId: string,
    @Param('id') orderId: string,
    @Body('resolutionNotes') notes: string,
  ) {
    return this.adminService.resolveException(adminUserId, orderId, notes || 'Resolved by admin');
  }

  @Post('orders/:id/refund')
  async refundOrder(
    @Headers('x-user-id') adminUserId: string,
    @Param('id') orderId: string,
    @Body('amount') amount: number,
  ) {
    return this.adminService.refundOrder(adminUserId, orderId, amount);
  }
}
