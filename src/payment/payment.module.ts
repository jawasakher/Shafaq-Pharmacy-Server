import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PaymentController } from './payment.controller.js';
import { PaymentProviderPort } from './payment-provider.port.js';
import { PaymentService } from './payment.service.js';
import { ShamCashAdapter } from './sham-cash.adapter.js';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    ShamCashAdapter,
    {
      provide: PaymentProviderPort,
      useClass: ShamCashAdapter,
    },
  ],
  exports: [PaymentService, PaymentProviderPort],
})
export class PaymentModule {}
