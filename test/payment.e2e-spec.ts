import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { AuthSessionService } from '../src/identity/auth-session.service.js';
import { OTP_DELIVERY } from '../src/identity/otp-delivery.port.js';
import { TestOtpDeliveryService } from '../src/identity/test-otp-delivery.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Payment API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authSessionService: AuthSessionService;

  const createdUserIds = new Set<string>();
  const createdOrderIds = new Set<string>();
  const createdPharmacyIds = new Set<string>();

  let phoneSequence = 0;
  const nextPhone = () =>
    '+963993' + Date.now().toString().slice(-6) + (++phoneSequence);

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OTP_DELIVERY)
      .useClass(TestOtpDeliveryService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    authSessionService = app.get(AuthSessionService);
  });

  afterEach(async () => {
    if (createdOrderIds.size > 0) {
      await prisma.paymentEvent.deleteMany({
        where: { payment: { orderId: { in: Array.from(createdOrderIds) } } },
      });
      await prisma.payment.deleteMany({
        where: { orderId: { in: Array.from(createdOrderIds) } },
      });
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: Array.from(createdOrderIds) } },
      });
      await prisma.pharmacyAssignment.deleteMany({
        where: { orderId: { in: Array.from(createdOrderIds) } },
      });
      await prisma.order.deleteMany({
        where: { id: { in: Array.from(createdOrderIds) } },
      });
    }

    if (createdPharmacyIds.size > 0) {
      await prisma.pharmacyMember.deleteMany({
        where: { pharmacyId: { in: Array.from(createdPharmacyIds) } },
      });
      await prisma.pharmacy.deleteMany({
        where: { id: { in: Array.from(createdPharmacyIds) } },
      });
    }

    if (createdUserIds.size > 0) {
      await prisma.authSession.deleteMany({
        where: { userId: { in: Array.from(createdUserIds) } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
    }

    if (app) {
      await app.close();
    }
  });

  const createCustomer = async () => {
    const phone = nextPhone();
    const user = await prisma.user.create({
      data: { phone, role: 'CUSTOMER' },
    });
    createdUserIds.add(user.id);

    const session = await authSessionService.createCustomerSession(user.id);
    return { user, token: session.token };
  };

  const createPharmacy = async () => {
    const pharmacy = await prisma.pharmacy.create({
      data: {
        name: 'Test Pharmacy Payment',
        latitude: 33.5138,
        longitude: 36.2765,
        approvalStatus: 'APPROVED',
        operationalStatus: 'OPEN',
      },
    });
    createdPharmacyIds.add(pharmacy.id);

    const ownerPhone = nextPhone();
    const owner = await prisma.user.create({
      data: { phone: ownerPhone, role: 'OWNER' },
    });
    createdUserIds.add(owner.id);

    await prisma.pharmacyMember.create({
      data: {
        pharmacyId: pharmacy.id,
        userId: owner.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    const session = await authSessionService.createInternalSession(owner.id);
    return { pharmacy, owner, token: session.token };
  };

  it('creates a payment attempt idempotently and handles webhooks correctly', async () => {
    const customer = await createCustomer();
    const { pharmacy } = await createPharmacy();

    const order = await prisma.order.create({
      data: {
        customerId: customer.user.id,
        pharmacyId: pharmacy.id,
        status: 'CUSTOMER_CONFIRMATION_PENDING',
        deliveryAddress: 'Damascus, Syria',
        deliveryLatitude: 33.5138,
        deliveryLongitude: 36.2765,
        medicineSubtotal: 5000,
        deliveryFee: 1000,
        totalAmount: 6000,
        currency: 'SYP',
      },
    });
    createdOrderIds.add(order.id);

    const idempotencyKey = 'ik_test_' + Date.now();

    // 1. Initial Payment Request
    const res1 = await request(app.getHttpServer())
      .post('/payments/pay')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('x-user-id', customer.user.id)
      .send({ orderId: order.id, idempotencyKey });

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    expect(res1.body.data.idempotent).toBe(false);
    expect(res1.body.data.amount).toBe(6000);
    expect(res1.body.data.status).toBe('PROCESSING');

    const paymentId = res1.body.data.paymentId;
    const providerTransactionId = res1.body.data.providerTransactionId;

    // Verify Order status moved to PAYMENT_PENDING
    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder?.status).toBe('PAYMENT_PENDING');

    // 2. Duplicate Payment Request with Same Idempotency Key
    const res2 = await request(app.getHttpServer())
      .post('/payments/pay')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('x-user-id', customer.user.id)
      .send({ orderId: order.id, idempotencyKey });

    expect(res2.status).toBe(201);
    expect(res2.body.data.idempotent).toBe(true);
    expect(res2.body.data.paymentId).toBe(paymentId);

    // 3. Process Valid Webhook for PAID Status
    const providerEventId = 'evt_' + Date.now();
    const webhookRes = await request(app.getHttpServer())
      .post('/payments/webhooks/sham-cash')
      .set('x-sham-cash-signature', 'valid-sig')
      .send({
        providerEventId,
        providerTransactionId,
        idempotencyKey,
        status: 'PAID',
        payload: { event: 'payment.succeeded' },
      });

    expect(webhookRes.status).toBe(201);
    expect(webhookRes.body.success).toBe(true);
    expect(webhookRes.body.processed).toBe(true);

    // Verify Payment is now PAID and Order is now PAID
    const paidPayment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(paidPayment?.status).toBe('PAID');
    expect(paidPayment?.paidAt).not.toBeNull();

    const paidOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(paidOrder?.status).toBe('PAID');

    // 4. Duplicate Webhook Event Delivery
    const duplicateWebhookRes = await request(app.getHttpServer())
      .post('/payments/webhooks/sham-cash')
      .set('x-sham-cash-signature', 'valid-sig')
      .send({
        providerEventId,
        providerTransactionId,
        idempotencyKey,
        status: 'PAID',
        payload: { event: 'payment.succeeded' },
      });

    expect(duplicateWebhookRes.status).toBe(201);
    expect(duplicateWebhookRes.body.processed).toBe(false);
    expect(duplicateWebhookRes.body.reason).toBe('DUPLICATE_EVENT');
  });

  it('prevents unauthorized payment creation for other customer orders', async () => {
    const customer1 = await createCustomer();
    const customer2 = await createCustomer();
    const { pharmacy } = await createPharmacy();

    const order = await prisma.order.create({
      data: {
        customerId: customer1.user.id,
        pharmacyId: pharmacy.id,
        status: 'CUSTOMER_CONFIRMATION_PENDING',
        deliveryAddress: 'Damascus, Syria',
        deliveryLatitude: 33.5138,
        deliveryLongitude: 36.2765,
        totalAmount: 5000,
      },
    });
    createdOrderIds.add(order.id);

    const res = await request(app.getHttpServer())
      .post('/payments/pay')
      .set('Authorization', `Bearer ${customer2.token}`)
      .set('x-user-id', customer2.user.id)
      .send({ orderId: order.id, idempotencyKey: 'ik_unauth_' + Date.now() });

    expect(res.status).toBe(403);
  });
});
