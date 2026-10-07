import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class PaymentWebhookDto {
  @IsString()
  @IsNotEmpty()
  providerEventId: string;

  @IsString()
  @IsNotEmpty()
  providerTransactionId: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @IsString()
  @IsNotEmpty()
  status: 'PAID' | 'FAILED' | 'PROCESSING' | 'CANCELLED';

  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;
}
