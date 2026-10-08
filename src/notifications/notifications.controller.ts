import { Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { CustomerIdentityGuard } from '../identity/customer-identity.guard.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(CustomerIdentityGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Headers('x-user-id') userId: string) {
    return this.notificationsService.getNotifications(userId);
  }

  @Post(':id/read')
  async markAsRead(
    @Headers('x-user-id') userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(userId, notificationId);
  }

  @Post('read-all')
  async markAllAsRead(@Headers('x-user-id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }
}
