import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CustomerIdentityGuard } from '../identity/customer-identity.guard.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { PaymentService } from './payment.service.js';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('pay')
  @UseGuards(CustomerIdentityGuard)
  async createPayment(
    @Headers('x-user-id') customerId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentService.createPayment(customerId, dto);
  }

  @Post('webhooks/sham-cash')
  async handleShamCashWebhook(
    @Headers() headers: Record<string, any>,
    @Body() body: any,
  ) {
    return this.paymentService.handleWebhook(headers, body);
  }

  @Get('orders/:orderId')
  @UseGuards(CustomerIdentityGuard)
  async getPaymentByOrder(
    @Headers('x-user-id') customerId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentService.getPaymentByOrderId(customerId, orderId);
  }

  @Post(':id/reconcile')
  @UseGuards(CustomerIdentityGuard)
  async reconcilePayment(@Param('id') paymentId: string) {
    return this.paymentService.reconcilePayment(paymentId);
  }
}
