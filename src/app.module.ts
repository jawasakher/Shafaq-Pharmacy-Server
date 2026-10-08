import { Module } from '@nestjs/common';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { IdentityModule } from './identity/identity.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PharmacyModule } from './pharmacy/pharmacy.module.js';
import { DeliveryModule } from './delivery/delivery.module.js';
import { ConsultationModule } from './consultation/consultation.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AdminModule } from './admin/admin.module.js';
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
    DeliveryModule,
    ConsultationModule,
    NotificationsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}