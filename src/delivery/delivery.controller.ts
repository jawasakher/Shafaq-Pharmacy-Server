import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { CustomerIdentityGuard } from '../identity/customer-identity.guard.js';
import { InternalIdentityGuard } from '../identity/internal-identity.guard.js';
import { DeliveryService } from './delivery.service.js';

@Controller('deliveries')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('orders/:orderId/start-search')
  @UseGuards(InternalIdentityGuard)
  async startDriverSearch(@Param('orderId') orderId: string) {
    return this.deliveryService.startDriverSearch(orderId);
  }

  @Get(':id')
  @UseGuards(CustomerIdentityGuard)
  async getDelivery(
    @Headers('x-user-id') userId: string,
    @Param('id') deliveryId: string,
  ) {
    return this.deliveryService.getDeliveryById(userId, deliveryId);
  }

  @Get(':id/location')
  @UseGuards(CustomerIdentityGuard)
  async getDeliveryLocation(@Param('id') deliveryId: string) {
    return this.deliveryService.getDeliveryLocation(deliveryId);
  }

  @Post(':id/generate-otp')
  @UseGuards(InternalIdentityGuard)
  async generateOtp(@Param('id') deliveryId: string) {
    return this.deliveryService.generateDeliveryOtp(deliveryId);
  }
}
