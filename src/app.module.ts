import { Module } from '@nestjs/common';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { IdentityModule } from './identity/identity.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PharmacyModule } from './pharmacy/pharmacy.module.js';
import { PaymentModule } from './payment/payment.module.js';
import { PrescriptionModule } from './prescription/prescription.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    PharmacyModule,
    OrdersModule,
    PrescriptionModule,
    PaymentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}