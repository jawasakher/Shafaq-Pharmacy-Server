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

describe('Admin & Notifications API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authSessionService: AuthSessionService;

  const createdUserIds = new Set<string>();
  const createdPharmacyIds = new Set<string>();

  let phoneSequence = 0;
  const nextPhone = () =>
    '+963996' + Date.now().toString().slice(-6) + (++phoneSequence);

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
    if (createdPharmacyIds.size > 0) {
      await prisma.pharmacyMember.deleteMany({
        where: { pharmacyId: { in: Array.from(createdPharmacyIds) } },
      });
      await prisma.pharmacy.deleteMany({
        where: { id: { in: Array.from(createdPharmacyIds) } },
      });
    }

    if (createdUserIds.size > 0) {
      await prisma.auditLog.deleteMany({
        where: { actorId: { in: Array.from(createdUserIds) } },
      });
      await prisma.notification.deleteMany({
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

  const createAdmin = async () => {
    const phone = nextPhone();
    const user = await prisma.user.create({
      data: { phone, role: 'ADMIN', name: 'Super Admin' },
    });
    createdUserIds.add(user.id);
    const session = await authSessionService.createInternalSession(user.id);
    return { user, token: session.token };
  };

  const createCustomer = async () => {
    const phone = nextPhone();
    const user = await prisma.user.create({
      data: { phone, role: 'CUSTOMER' },
    });
    createdUserIds.add(user.id);
    const session = await authSessionService.createCustomerSession(user.id);
    return { user, token: session.token };
  };

  it('restricts admin endpoints to ADMIN role only', async () => {
    const customer = await createCustomer();

    const res = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('x-user-id', customer.user.id);

    expect(res.status).toBe(401);
  });

  it('allows admin to view overview, list pharmacies, approve pharmacy, and view audit logs', async () => {
    const admin = await createAdmin();

    const pharmacy = await prisma.pharmacy.create({
      data: {
        name: 'Pending Admin Pharmacy',
        latitude: 33.5138,
        longitude: 36.2765,
        approvalStatus: 'PENDING_APPROVAL',
        operationalStatus: 'CLOSED',
      },
    });
    createdPharmacyIds.add(pharmacy.id);

    // 1. Get Overview
    const overviewRes = await request(app.getHttpServer())
      .get('/admin/overview')
      .set('Authorization', `Bearer ${admin.token}`)
      .set('x-user-id', admin.user.id);

    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.success).toBe(true);
    expect(overviewRes.body.data.pendingPharmacies).toBe(1);

    // 2. Approve Pharmacy
    const approveRes = await request(app.getHttpServer())
      .post(`/admin/pharmacies/${pharmacy.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .set('x-user-id', admin.user.id);

    expect(approveRes.status).toBe(201);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.data.approvalStatus).toBe('APPROVED');

    // 3. View Audit Logs
    const logsRes = await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .set('Authorization', `Bearer ${admin.token}`)
      .set('x-user-id', admin.user.id);

    expect(logsRes.status).toBe(200);
    expect(logsRes.body.success).toBe(true);
    expect(logsRes.body.data.length).toBeGreaterThan(0);
    expect(logsRes.body.data[0].action).toBe('APPROVE_PHARMACY');
  });

  it('allows users to read and mark notifications as read', async () => {
    const customer = await createCustomer();

    // Create a manual notification
    await prisma.notification.create({
      data: {
        userId: customer.user.id,
        title: 'Order Confirmed',
        body: 'Your medicine order is confirmed.',
        type: 'ORDER_STATUS',
      },
    });

    // List notifications
    const listRes = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('x-user-id', customer.user.id);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBe(1);

    const notifId = listRes.body.data[0].id;
    expect(listRes.body.data[0].isRead).toBe(false);

    // Mark as read
    const readRes = await request(app.getHttpServer())
      .post(`/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${customer.token}`)
      .set('x-user-id', customer.user.id);

    expect(readRes.status).toBe(201);
    expect(readRes.body.success).toBe(true);
    expect(readRes.body.data.isRead).toBe(true);
  });
});
