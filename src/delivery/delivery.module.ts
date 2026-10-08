import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DeliveryController } from './delivery.controller.js';
import { DeliveryService } from './delivery.service.js';
import { DriverController } from './driver.controller.js';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [DeliveryController, DriverController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
