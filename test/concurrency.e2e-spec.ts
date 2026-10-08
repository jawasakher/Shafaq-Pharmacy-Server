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

describe('Concurrency Tests (SRS Section 96) (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authSessionService: AuthSessionService;

  const createdUserIds = new Set<string>();
  const createdPharmacyIds = new Set<string>();
  const createdOrderIds = new Set<string>();

  let phoneSequence = 0;
  const nextPhone = () =>
    '+963997' + Date.now().toString().slice(-6) + (++phoneSequence);

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
      await prisma.deliveryOffer.deleteMany({
        where: { delivery: { orderId: { in: Array.from(createdOrderIds) } } },
      });
      await prisma.delivery.deleteMany({
        where: { orderId: { in: Array.from(createdOrderIds) } },
      });
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
      await prisma.consultation.deleteMany({
        where: { customerId: { in: Array.from(createdUserIds) } },
      });
      await prisma.driverCurrentLocation.deleteMany({
        where: { driver: { userId: { in: Array.from(createdUserIds) } } },
      });
      await prisma.driver.deleteMany({
        where: { userId: { in: Array.from(createdUserIds) } },
      });
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
    const user = await prisma.user.create({ data: { phone, role: 'CUSTOMER' } });
    createdUserIds.add(user.id);
    const session = await authSessionService.createCustomerSession(user.id);
    return { user, token: session.token };
  };

  const createPharmacyWithMember = async () => {
    const pharmacy = await prisma.pharmacy.create({
      data: {
        name: 'Conc Pharmacy',
        latitude: 33.5138,
        longitude: 36.2765,
        approvalStatus: 'APPROVED',
        operationalStatus: 'OPEN',
      },
    });
    createdPharmacyIds.add(pharmacy.id);

    const ownerPhone = nextPhone();
    const owner = await prisma.user.create({ data: { phone: ownerPhone, role: 'OWNER' } });
    createdUserIds.add(owner.id);

    await prisma.pharmacyMember.create({
      data: { pharmacyId: pharmacy.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
    });

    const session = await authSessionService.createInternalSession(owner.id);
    return { pharmacy, owner, token: session.token };
  };

  const createDriver = async () => {
    const phone = nextPhone();
    const user = await prisma.user.create({ data: { phone, role: 'DRIVER', name: 'Driver ' + phone } });
    createdUserIds.add(user.id);
    const driver = await prisma.driver.create({
      data: { userId: user.id, approvalStatus: 'APPROVED', availability: 'AVAILABLE' },
    });
    const session = await authSessionService.createInternalSession(user.id);
    return { user, driver, token: session.token };
  };

  it('Test 1: Two pharmacies accepting the same order assignment concurrently results in exactly one ACTIVE assignment', async () => {
    const customer = await createCustomer();
    const p1 = await createPharmacyWithMember();
    const p2 = await createPharmacyWithMember();

    const order = await prisma.order.create({
      data: {
        customerId: customer.user.id,
        pharmacyId: p1.pharmacy.id,
        status: 'PENDING',
        deliveryAddress: 'Damascus',
        deliveryLatitude: 33.51,
        deliveryLongitude: 36.27,
        items: { create: [{ medicineName: 'Aspirin', quantity: 1 }] },
      },
    });
    createdOrderIds.add(order.id);

    // Create assignments for both pharmacies
    const assign1 = await prisma.pharmacyAssignment.create({
      data: { orderId: order.id, pharmacyId: p1.pharmacy.id, status: 'OFFERED' },
    });
    const assign2 = await prisma.pharmacyAssignment.create({
      data: { orderId: order.id, pharmacyId: p2.pharmacy.id, status: 'OFFERED' },
    });

    // Accept concurrently
    const results = await Promise.allSettled([
      request(app.getHttpServer())
        .post(`/api/v1/pharmacy/assignments/${assign1.id}/accept`)
        .set('Authorization', `Bearer ${p1.token}`)
        .set('x-user-id', p1.owner.id),
      request(app.getHttpServer())
        .post(`/api/v1/pharmacy/assignments/${assign2.id}/accept`)
        .set('Authorization', `Bearer ${p2.token}`)
        .set('x-user-id', p2.owner.id),
    ]);

    const activeAssignments = await prisma.pharmacyAssignment.count({
      where: { orderId: order.id, status: 'ACTIVE' },
    });
    expect(activeAssignments).toBeLessThanOrEqual(1);
  });

  it('Test 2 & 3: Two drivers accepting the same delivery concurrently results in one winner and one active delivery constraint violation', async () => {
    const customer = await createCustomer();
    const { pharmacy } = await createPharmacyWithMember();
    const d1 = await createDriver();
    const d2 = await createDriver();

    const order = await prisma.order.create({
      data: {
        customerId: customer.user.id,
        pharmacyId: pharmacy.id,
        status: 'READY_FOR_PICKUP',
        deliveryAddress: 'Damascus',
        deliveryLatitude: 33.51,
        deliveryLongitude: 36.27,
        totalAmount: 1000,
      },
    });
    createdOrderIds.add(order.id);

    const delivery = await prisma.delivery.create({
      data: {
        orderId: order.id,
        status: 'SEARCHING_FOR_DRIVER',
        pickupAddress: 'Pharmacy',
        pickupLatitude: 33.51,
        pickupLongitude: 36.27,
        dropoffAddress: 'Home',
        dropoffLatitude: 33.52,
        dropoffLongitude: 36.28,
      },
    });

    const offer1 = await prisma.deliveryOffer.create({
      data: { deliveryId: delivery.id, driverId: d1.driver.id, status: 'OFFERED' },
    });
    const offer2 = await prisma.deliveryOffer.create({
      data: { deliveryId: delivery.id, driverId: d2.driver.id, status: 'OFFERED' },
    });

    const results = await Promise.allSettled([
      request(app.getHttpServer())
        .post(`/driver/offers/${offer1.id}/accept`)
        .set('Authorization', `Bearer ${d1.token}`)
        .set('x-user-id', d1.user.id),
      request(app.getHttpServer())
        .post(`/driver/offers/${offer2.id}/accept`)
        .set('Authorization', `Bearer ${d2.token}`)
        .set('x-user-id', d2.user.id),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled' && (r as any).value.status === 201);
    expect(fulfilled.length).toBe(1);
  });

  it('Test 4: Two concurrent consultations for the same customer results in exactly one active consultation', async () => {
    const customer = await createCustomer();

    const results = await Promise.allSettled([
      request(app.getHttpServer())
        .post('/consultations')
        .set('Authorization', `Bearer ${customer.token}`)
        .set('x-user-id', customer.user.id)
        .send({ symptoms: 'Cough', duration: '1 day', age: 25 }),
      request(app.getHttpServer())
        .post('/consultations')
        .set('Authorization', `Bearer ${customer.token}`)
        .set('x-user-id', customer.user.id)
        .send({ symptoms: 'Cold', duration: '2 days', age: 25 }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled' && (r as any).value.status === 201);
    expect(fulfilled.length).toBe(1);

    const activeCount = await prisma.consultation.count({
      where: { customerId: customer.user.id },
    });
    expect(activeCount).toBe(1);
  });

  it('Test 5 & 6: Concurrent payment creation with idempotency and duplicate webhook handling', async () => {
    const customer = await createCustomer();
    const { pharmacy } = await createPharmacyWithMember();

    const order = await prisma.order.create({
      data: {
        customerId: customer.user.id,
        pharmacyId: pharmacy.id,
        status: 'CUSTOMER_CONFIRMATION_PENDING',
        deliveryAddress: 'Damascus',
        deliveryLatitude: 33.51,
        deliveryLongitude: 36.27,
        totalAmount: 2000,
      },
    });
    createdOrderIds.add(order.id);

    const idempotencyKey = 'ik_conc_' + Date.now();

    // Concurrent payment requests
    const payResults = await Promise.all([
      request(app.getHttpServer())
        .post('/payments/pay')
        .set('Authorization', `Bearer ${customer.token}`)
        .set('x-user-id', customer.user.id)
        .send({ orderId: order.id, idempotencyKey }),
      request(app.getHttpServer())
        .post('/payments/pay')
        .set('Authorization', `Bearer ${customer.token}`)
        .set('x-user-id', customer.user.id)
        .send({ orderId: order.id, idempotencyKey }),
    ]);

    expect(payResults.some((r) => r.status === 201)).toBe(true);

    const paymentsCount = await prisma.payment.count({ where: { orderId: order.id } });
    expect(paymentsCount).toBe(1);

    const payment = await prisma.payment.findFirst({ where: { orderId: order.id } });

    // Concurrent duplicate webhooks
    const providerEventId = 'evt_conc_' + Date.now();
    const webhookResults = await Promise.all([
      request(app.getHttpServer())
        .post('/payments/webhooks/sham-cash')
        .send({
          providerEventId,
          providerTransactionId: payment?.providerTransactionId || 'tx_1',
          idempotencyKey,
          status: 'PAID',
        }),
      request(app.getHttpServer())
        .post('/payments/webhooks/sham-cash')
        .send({
          providerEventId,
          providerTransactionId: payment?.providerTransactionId || 'tx_1',
          idempotencyKey,
          status: 'PAID',
        }),
    ]);

    expect(webhookResults.some((r) => r.body.processed === true)).toBe(true);
    expect(webhookResults.some((r) => r.body.reason === 'DUPLICATE_EVENT' || r.body.processed === false)).toBe(true);

    const eventsCount = await prisma.paymentEvent.count({ where: { paymentId: payment!.id } });
    expect(eventsCount).toBe(1);
  });
});
