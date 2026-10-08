import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { InternalIdentityGuard } from '../identity/internal-identity.guard.js';
import { DeliveryService } from './delivery.service.js';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { ConfirmCashDto } from './dto/confirm-cash.dto.js';

@Controller('driver')
@UseGuards(InternalIdentityGuard)
export class DriverController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('offers')
  async getOffers(@Headers('x-user-id') driverUserId: string) {
    return this.deliveryService.getDriverOffers(driverUserId);
  }

  @Post('offers/:id/accept')
  async acceptOffer(
    @Headers('x-user-id') driverUserId: string,
    @Param('id') offerId: string,
  ) {
    return this.deliveryService.acceptOffer(driverUserId, offerId);
  }

  @Post('offers/:id/reject')
  async rejectOffer(
    @Headers('x-user-id') driverUserId: string,
    @Param('id') offerId: string,
  ) {
    return this.deliveryService.rejectOffer(driverUserId, offerId);
  }

  @Post('deliveries/:id/status')
  async updateStatus(
    @Headers('x-user-id') driverUserId: string,
    @Param('id') deliveryId: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.deliveryService.updateDeliveryStatus(
      driverUserId,
      deliveryId,
      dto.status,
    );
  }

  @Post('deliveries/:id/verify-otp')
  async verifyOtp(
    @Headers('x-user-id') driverUserId: string,
    @Param('id') deliveryId: string,
    @Body() dto: VerifyOtpDto,
  ) {
    return this.deliveryService.verifyDeliveryOtp(driverUserId, deliveryId, dto.code);
  }

  @Post('deliveries/:id/confirm-cash')
  async confirmCash(
    @Headers('x-user-id') driverUserId: string,
    @Param('id') deliveryId: string,
    @Body() dto: ConfirmCashDto,
  ) {
    return this.deliveryService.confirmCash(
      driverUserId,
      deliveryId,
      dto.receivedAmount,
      dto.reason,
    );
  }

  @Post('location')
  async updateLocation(
    @Headers('x-user-id') driverUserId: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.deliveryService.updateDriverLocation(driverUserId, dto);
  }

  @Post('deliveries/:id/unable-to-complete')
  async unableToComplete(
    @Headers('x-user-id') driverUserId: string,
    @Param('id') deliveryId: string,
    @Body('reason') reason: string,
  ) {
    return this.deliveryService.unableToComplete(driverUserId, deliveryId, reason);
  }
}
