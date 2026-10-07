import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { PaymentProviderPort } from './payment-provider.port.js';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProvider: PaymentProviderPort,
  ) {}

  async createPayment(customerId: string, dto: CreatePaymentDto) {
    const { orderId, idempotencyKey } = dto;

    const existingPayment = await this.prisma.payment.findUnique({
      where: {
        provider_idempotencyKey: {
          provider: 'SHAM_CASH',
          idempotencyKey,
        },
      },
      include: { order: true },
    });

    if (existingPayment) {
      if (existingPayment.order.customerId !== customerId) {
        throw new ForbiddenException('Order does not belong to the user');
      }
      return {
        success: true,
        data: {
          paymentId: existingPayment.id,
          orderId: existingPayment.orderId,
          status: existingPayment.status,
          amount: Number(existingPayment.amount),
          currency: existingPayment.currency,
          providerTransactionId: existingPayment.providerTransactionId,
          idempotent: true,
        },
      };
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('Order does not belong to the user');
    }

    if (
      order.status !== OrderStatus.CUSTOMER_CONFIRMATION_PENDING &&
      order.status !== OrderStatus.PHARMACY_CONFIRMED &&
      order.status !== OrderStatus.PAYMENT_PENDING
    ) {
      throw new BadRequestException(
        `Order is not in a valid state for payment. Current status: ${order.status}`,
      );
    }

    if (!order.totalAmount || Number(order.totalAmount) <= 0) {
      throw new BadRequestException('Order total amount is not set or invalid');
    }

    const totalAmount = Number(order.totalAmount);

    const providerResult = await this.paymentProvider.createPayment({
      orderId: order.id,
      amount: totalAmount,
      currency: order.currency || 'SYP',
      idempotencyKey,
    });

    const payment = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        if (order.status !== OrderStatus.PAYMENT_PENDING) {
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.PAYMENT_PENDING },
          });
        }

        return tx.payment.create({
          data: {
            orderId: order.id,
            provider: 'SHAM_CASH',
            providerTransactionId: providerResult.providerTransactionId,
            idempotencyKey,
            amount: order.totalAmount!,
            currency: order.currency || 'SYP',
            status: providerResult.status,
          },
        });
      },
    );

    return {
      success: true,
      data: {
        paymentId: payment.id,
        orderId: payment.orderId,
        status: payment.status,
        amount: Number(payment.amount),
        currency: payment.currency,
        providerTransactionId: payment.providerTransactionId,
        idempotent: false,
      },
    };
  }

  async handleWebhook(headers: Record<string, any>, body: any) {
    const verified = await this.paymentProvider.verifyWebhook({ headers, body });

    if (!verified.isValid || !verified.providerEventId) {
      throw new BadRequestException('Invalid webhook signature or payload');
    }

    const existingEvent = await this.prisma.paymentEvent.findUnique({
      where: { providerEventId: verified.providerEventId },
    });

    if (existingEvent) {
      this.logger.log(`Duplicate webhook event ignored: ${verified.providerEventId}`);
      return { success: true, processed: false, reason: 'DUPLICATE_EVENT' };
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { idempotencyKey: verified.idempotencyKey },
          { providerTransactionId: verified.providerTransactionId },
        ],
      },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException('Associated payment record not found');
    }

    const newStatus = verified.status || PaymentStatus.PROCESSING;

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          providerEventId: verified.providerEventId!,
          eventType: verified.status || 'STATUS_UPDATE',
          payload: verified.payload || {},
        },
      });

      if (payment.status === PaymentStatus.PAID) {
        this.logger.log(`Payment ${payment.id} is already PAID. Ignoring backward transition.`);
        return;
      }

      const isPaidNow = newStatus === PaymentStatus.PAID;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          providerTransactionId: verified.providerTransactionId || payment.providerTransactionId,
          paidAt: isPaidNow ? new Date() : payment.paidAt,
        },
      });

      if (isPaidNow && payment.order.status !== OrderStatus.PAID) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: OrderStatus.PAID },
        });
      }
    });

    return { success: true, processed: true, paymentId: payment.id, newStatus };
  }

  async getPaymentByOrderId(customerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    const payments = await this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: payments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        provider: p.provider,
        providerTransactionId: p.providerTransactionId,
        idempotencyKey: p.idempotencyKey,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
      })),
    };
  }

  async reconcilePayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!payment.providerTransactionId) {
      throw new BadRequestException('No provider transaction ID available for reconciliation');
    }

    const statusResult = await this.paymentProvider.checkStatus(payment.providerTransactionId);

    if (statusResult.status === PaymentStatus.PAID && payment.status !== PaymentStatus.PAID) {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.PAID, paidAt: new Date() },
        });

        if (payment.order.status !== OrderStatus.PAID) {
          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: OrderStatus.PAID },
          });
        }
      });
    }

    return { success: true, paymentId: payment.id, status: statusResult.status };
  }
}
