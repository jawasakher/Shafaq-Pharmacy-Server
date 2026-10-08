import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { InternalIdentityGuard } from '../identity/internal-identity.guard.js';
import { DeliveryService } from './delivery.service.js';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto.js';

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
}
