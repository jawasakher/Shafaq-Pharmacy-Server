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

describe('Delivery API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authSessionService: AuthSessionService;

  const createdUserIds = new Set<string>();
  const createdOrderIds = new Set<string>();
  const createdPharmacyIds = new Set<string>();
  const createdDriverIds = new Set<string>();

  let phoneSequence = 0;
  const nextPhone = () =>
    '+963994' + Date.now().toString().slice(-6) + (++phoneSequence);

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
      await prisma.deliveryException.deleteMany({
        where: { delivery: { orderId: { in: Array.from(createdOrderIds) } } },
      });
      await prisma.cashCollection.deleteMany({
        where: { delivery: { orderId: { in: Array.from(createdOrderIds) } } },
      });
      await prisma.deliveryOtp.deleteMany({
        where: { delivery: { orderId: { in: Array.from(createdOrderIds) } } },
      });
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

    if (createdDriverIds.size > 0) {
      await prisma.driverCurrentLocation.deleteMany({
        where: { driverId: { in: Array.from(createdDriverIds) } },
      });
      await prisma.driverLocationHistory.deleteMany({
        where: { driverId: { in: Array.from(createdDriverIds) } },
      });
      await prisma.driver.deleteMany({
        where: { id: { in: Array.from(createdDriverIds) } },
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
        name: 'Test Pharmacy Delivery',
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

  const createDriver = async () => {
    const phone = nextPhone();
    const user = await prisma.user.create({
      data: { phone, role: 'DRIVER', name: 'Driver ' + phone },
    });
    createdUserIds.add(user.id);

    const driver = await prisma.driver.create({
      data: {
        userId: user.id,
        approvalStatus: 'APPROVED',
        availability: 'AVAILABLE',
      },
    });
    createdDriverIds.add(driver.id);

    const session = await authSessionService.createInternalSession(user.id);
    return { user, driver, token: session.token };
  };

  it('handles PRE-PICKUP unable-to-complete correctly by re-searching for drivers', async () => {
    const customer = await createCustomer();
    const { pharmacy, owner, token: ownerToken } = await createPharmacy();
    const driver = await createDriver();

    const order = await prisma.order.create({
      data: {
        customerId: customer.user.id,
        pharmacyId: pharmacy.id,
        status: 'READY_FOR_PICKUP',
        deliveryAddress: 'Damascus, Syria',
        deliveryLatitude: 33.5138,
        deliveryLongitude: 36.2765,
        totalAmount: 5000,
        currency: 'SYP',
      },
    });
    createdOrderIds.add(order.id);

    await prisma.pharmacyAssignment.create({
      data: { orderId: order.id, pharmacyId: pharmacy.id, status: 'ACTIVE' },
    });

    const searchRes = await request(app.getHttpServer())
      .post(`/deliveries/orders/${order.id}/start-search`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-user-id', owner.id);

    const deliveryId = searchRes.body.deliveryId;

    const offer = await prisma.deliveryOffer.findFirst({
      where: { deliveryId, driverId: driver.driver.id },
    });

    await request(app.getHttpServer())
      .post(`/driver/offers/${offer!.id}/accept`)
      .set('Authorization', `Bearer ${driver.token}`)
      .set('x-user-id', driver.user.id);

    // Call unable-to-complete (Pre-Pickup)
    const unableRes = await request(app.getHttpServer())
      .post(`/driver/deliveries/${deliveryId}/unable-to-complete`)
      .set('Authorization', `Bearer ${driver.token}`)
      .set('x-user-id', driver.user.id)
      .send({ reason: 'Motorcycle broke down' });

    expect(unableRes.status).toBe(201);
    expect(unableRes.body.success).toBe(true);
    expect(unableRes.body.action).toBe('REASSIGNED');

    // Verify driver is available
    const updatedDriver = await prisma.driver.findUnique({ where: { id: driver.driver.id } });
    expect(updatedDriver?.availability).toBe('AVAILABLE');

    // Verify delivery is searching again
    const updatedDelivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
    expect(updatedDelivery?.status).toBe('SEARCHING_FOR_DRIVER');
    expect(updatedDelivery?.driverId).toBeNull();
  });

  it('handles POST-PICKUP unable-to-complete correctly by keeping driver busy and opening an exception', async () => {
    const customer = await createCustomer();
    const { pharmacy, owner, token: ownerToken } = await createPharmacy();
    const driver = await createDriver();

    const order = await prisma.order.create({
      data: {
        customerId: customer.user.id,
        pharmacyId: pharmacy.id,
        status: 'READY_FOR_PICKUP',
        deliveryAddress: 'Damascus, Syria',
        deliveryLatitude: 33.5138,
        deliveryLongitude: 36.2765,
        totalAmount: 5000,
        currency: 'SYP',
      },
    });
    createdOrderIds.add(order.id);

    await prisma.pharmacyAssignment.create({
      data: { orderId: order.id, pharmacyId: pharmacy.id, status: 'ACTIVE' },
    });

    const searchRes = await request(app.getHttpServer())
      .post(`/deliveries/orders/${order.id}/start-search`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-user-id', owner.id);

    const deliveryId = searchRes.body.deliveryId;

    const offer = await prisma.deliveryOffer.findFirst({
      where: { deliveryId, driverId: driver.driver.id },
    });

    await request(app.getHttpServer())
      .post(`/driver/offers/${offer!.id}/accept`)
      .set('Authorization', `Bearer ${driver.token}`)
      .set('x-user-id', driver.user.id);

    // Update status to PICKED_UP
    await request(app.getHttpServer())
      .post(`/driver/deliveries/${deliveryId}/status`)
      .set('Authorization', `Bearer ${driver.token}`)
      .set('x-user-id', driver.user.id)
      .send({ status: 'PICKED_UP' });

    // Call unable-to-complete (Post-Pickup)
    const unableRes = await request(app.getHttpServer())
      .post(`/driver/deliveries/${deliveryId}/unable-to-complete`)
      .set('Authorization', `Bearer ${driver.token}`)
      .set('x-user-id', driver.user.id)
      .send({ reason: 'Customer unresponsive and phone off' });

    expect(unableRes.status).toBe(201);
    expect(unableRes.body.success).toBe(true);
    expect(unableRes.body.action).toBe('EXCEPTION_OPENED');
    expect(unableRes.body.exceptionId).toBeDefined();

    // Verify driver is STILL BUSY
    const updatedDriver = await prisma.driver.findUnique({ where: { id: driver.driver.id } });
    expect(updatedDriver?.availability).toBe('BUSY');

    // Verify delivery is EXCEPTION
    const updatedDelivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
    expect(updatedDelivery?.status).toBe('EXCEPTION');

    // Verify order is EXCEPTION
    const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder?.status).toBe('EXCEPTION');

    // Verify exception record
    const exception = await prisma.deliveryException.findUnique({ where: { id: unableRes.body.exceptionId } });
    expect(exception?.status).toBe('OPEN');
    expect(exception?.currentCustodian).toBe('DRIVER');
  });
});