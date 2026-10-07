import { Injectable, Logger } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import {
  CreateProviderPaymentInput,
  PaymentProviderPort,
  ProviderPaymentResult,
  VerifyWebhookInput,
  VerifiedWebhookResult,
} from './payment-provider.port.js';

@Injectable()
export class ShamCashAdapter extends PaymentProviderPort {
  private readonly logger = new Logger(ShamCashAdapter.name);

  async createPayment(input: CreateProviderPaymentInput): Promise<ProviderPaymentResult> {
    this.logger.log(`Initiating Sham Cash payment for order ${input.orderId} with amount ${input.amount} ${input.currency}`);
    const providerTransactionId = `sham_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return {
      providerTransactionId,
      status: PaymentStatus.PROCESSING,
      rawResponse: {
        provider: 'SHAM_CASH',
        providerTransactionId,
        checkoutUrl: `https://sandbox.shamcash.com/checkout/${providerTransactionId}`,
      },
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookResult> {
    const body = input.body;
    if (!body || !body.providerEventId) {
      return { isValid: false };
    }

    let mappedStatus: PaymentStatus = PaymentStatus.PROCESSING;
    if (body.status === 'SUCCESS' || body.status === 'PAID') {
      mappedStatus = PaymentStatus.PAID;
    } else if (body.status === 'FAILED') {
      mappedStatus = PaymentStatus.FAILED;
    } else if (body.status === 'CANCELLED') {
      mappedStatus = PaymentStatus.CANCELLED;
    }

    return {
      isValid: true,
      providerEventId: body.providerEventId,
      providerTransactionId: body.providerTransactionId,
      idempotencyKey: body.idempotencyKey,
      status: mappedStatus,
      payload: body,
    };
  }

  async checkStatus(providerTransactionId: string): Promise<ProviderPaymentResult> {
    this.logger.log(`Checking Sham Cash status for transaction ${providerTransactionId}`);
    return {
      providerTransactionId,
      status: PaymentStatus.PAID,
    };
  }
}
