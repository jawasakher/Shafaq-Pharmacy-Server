import { PaymentStatus } from '@prisma/client';

export interface CreateProviderPaymentInput {
  orderId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}

export interface ProviderPaymentResult {
  providerTransactionId: string;
  status: PaymentStatus;
  rawResponse?: Record<string, any>;
}

export interface VerifyWebhookInput {
  headers: Record<string, any>;
  body: any;
}

export interface VerifiedWebhookResult {
  isValid: boolean;
  providerEventId?: string;
  providerTransactionId?: string;
  idempotencyKey?: string;
  status?: PaymentStatus;
  payload?: Record<string, any>;
}

export abstract class PaymentProviderPort {
  abstract createPayment(input: CreateProviderPaymentInput): Promise<ProviderPaymentResult>;
  abstract verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookResult>;
  abstract checkStatus(providerTransactionId: string): Promise<ProviderPaymentResult>;
}
