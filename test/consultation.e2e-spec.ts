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

describe('Consultation API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authSessionService: AuthSessionService;

  const createdUserIds = new Set<string>();
  const createdPharmacyIds = new Set<string>();
  const createdConsultationIds = new Set<string>();

  let phoneSequence = 0;
  const nextPhone = () =>
    '+963995' + Date.now().toString().slice(-6) + (++phoneSequence);

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
    if (createdConsultationIds.size > 0) {
      await prisma.chatMessage.deleteMany({
        where: { consultationId: { in: Array.from(createdConsultationIds) } },
      });
      await prisma.consultationAssignmentHistory.deleteMany({
        where: { consultationId: { in: Array.from(createdConsultationIds) } },
      });
      await prisma.consultation.deleteMany({
        where: { id: { in: Array.from(createdConsultationIds) } },
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

  const createPharmacyWithPharmacist = async () => {
    const pharmacy = await prisma.pharmacy.create({
      data: {
        name: 'Consultation Pharmacy',
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
      data: { pharmacyId: pharmacy.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
    });

    const pharmacistPhone = nextPhone();
    const pharmacist = await prisma.user.create({
      data: { phone: pharmacistPhone, role: 'PHARMACIST', name: 'Dr. Pharmacist' },
    });
    createdUserIds.add(pharmacist.id);

    await prisma.pharmacyMember.create({
      data: { pharmacyId: pharmacy.id, userId: pharmacist.id, role: 'PHARMACIST', status: 'ACTIVE' },
    });

    const ownerSession = await authSessionService.createInternalSession(owner.id);
    const pharmacistSession = await authSessionService.createInternalSession(pharmacist.id);

    return {
      pharmacy,
      owner,
      ownerToken: ownerSession.token,
      pharmacist,
      pharmacistToken: pharmacistSession.token,
    };
  };

  it('allows customer to create consultation, owner to assign pharmacist, and secure chat between them', async () => {
    const customer = await createCustomer();
    const { pharmacy, owner, ownerToken, pharmacist, pharmacistToken } = await createPharmacyWithPharmacist();
    const outsider = await createCustomer();

    // 1. Create Consultation
    const createRes = await request(app.getHttpServer())
      .post('/consultations')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('x-user-id', customer.user.id)
      .send({
        symptoms: 'Headache and fever',
        duration: '2 days',
        age: 30,
        currentMedications: 'Paracetamol',
        allergies: 'None',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const consultationId = createRes.body.data.id;
    createdConsultationIds.add(consultationId);

    // 2. Prevent second active consultation
    const duplicateRes = await request(app.getHttpServer())
      .post('/consultations')
      .set('Authorization', `Bearer ${customer.token}`)
      .set('x-user-id', customer.user.id)
      .send({
        symptoms: 'Stomachache',
        duration: '1 day',
        age: 30,
      });

    expect(duplicateRes.status).toBe(409);

    // 3. Owner assigns pharmacist
    const assignRes = await request(app.getHttpServer())
      .post(`/consultations/${consultationId}/assign`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-user-id', owner.id)
      .send({
        pharmacistUserId: pharmacist.id,
        pharmacyId: pharmacy.id,
      });

    expect(assignRes.status).toBe(201);
    expect(assignRes.body.success).toBe(true);
    expect(assignRes.body.data.status).toBe('ASSIGNED');
    expect(assignRes.body.data.pharmacistId).toBe(pharmacist.id);

    // 4. Customer sends message
    const msg1Res = await request(app.getHttpServer())
      .post(`/consultations/${consultationId}/messages`)
      .set('Authorization', `Bearer ${customer.token}`)
      .set('x-user-id', customer.user.id)
      .send({ content: 'Hello doctor, what should I take?' });

    expect(msg1Res.status).toBe(201);
    expect(msg1Res.body.success).toBe(true);

    // 5. Pharmacist replies
    const msg2Res = await request(app.getHttpServer())
      .post(`/consultations/${consultationId}/messages`)
      .set('Authorization', `Bearer ${pharmacistToken}`)
      .set('x-user-id', pharmacist.id)
      .send({ content: 'Hello, please drink plenty of fluids and rest.' });

    expect(msg2Res.status).toBe(201);
    expect(msg2Res.body.success).toBe(true);

    // 6. Outsider is forbidden from reading messages
    const outsiderRes = await request(app.getHttpServer())
      .get(`/consultations/${consultationId}/messages`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .set('x-user-id', outsider.user.id)
      .set('x-user-role', 'CUSTOMER');

    expect(outsiderRes.status).toBe(403);
  });
});
