import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DriverApprovalStatus,
  OrderStatus,
  PharmacyApprovalStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async logAudit(
    tx: Prisma.TransactionClient | PrismaService,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, any>,
  ) {
    await tx.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        metadata: metadata || {},
      },
    });
  }

  async getOverview() {
    const activeOrders = await this.prisma.order.count({
      where: {
        status: {
          notIn: [OrderStatus.COMPLETED, OrderStatus.CLOSED, OrderStatus.EXCEPTION],
        },
      },
    });

    const exceptionOrders = await this.prisma.order.count({
      where: { status: OrderStatus.EXCEPTION },
    });

    const activeDeliveries = await this.prisma.delivery.count({
      where: {
        status: {
          notIn: ['COMPLETED', 'EXCEPTION'],
        },
      },
    });

    const pendingPharmacies = await this.prisma.pharmacy.count({
      where: { approvalStatus: PharmacyApprovalStatus.PENDING_APPROVAL },
    });

    const pendingDrivers = await this.prisma.driver.count({
      where: { approvalStatus: DriverApprovalStatus.PENDING_APPROVAL },
    });

    return {
      success: true,
      data: {
        activeOrders,
        exceptionOrders,
        activeDeliveries,
        pendingPharmacies,
        pendingDrivers,
      },
    };
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, phone: true, name: true, role: true, createdAt: true },
    });
    return { success: true, data: users };
  }

  async listPharmacies() {
    const pharmacies = await this.prisma.pharmacy.findMany({
      orderBy: { createdAt: 'desc' },
      include: { members: { include: { user: true } } },
    });
    return { success: true, data: pharmacies };
  }

  async listDrivers() {
    const drivers = await this.prisma.driver.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    return { success: true, data: drivers };
  }

  async listOrders() {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { customer: true, pharmacy: true, items: true },
      take: 100,
    });
    return { success: true, data: orders };
  }

  async listAuditLogs() {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, phone: true, name: true, role: true } } },
      take: 100,
    });
    return { success: true, data: logs };
  }

  async approvePharmacy(adminUserId: string, pharmacyId: string) {
    const pharmacy = await this.prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const p = await tx.pharmacy.update({
        where: { id: pharmacyId },
        data: { approvalStatus: PharmacyApprovalStatus.APPROVED },
      });
      await this.logAudit(tx, adminUserId, 'APPROVE_PHARMACY', 'Pharmacy', pharmacyId);
      return p;
    });

    return { success: true, data: updated };
  }

  async rejectPharmacy(adminUserId: string, pharmacyId: string) {
    const pharmacy = await this.prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const p = await tx.pharmacy.update({
        where: { id: pharmacyId },
        data: { approvalStatus: PharmacyApprovalStatus.REJECTED, operationalStatus: 'CLOSED' },
      });
      await this.logAudit(tx, adminUserId, 'REJECT_PHARMACY', 'Pharmacy', pharmacyId);
      return p;
    });

    return { success: true, data: updated };
  }

  async suspendPharmacy(adminUserId: string, pharmacyId: string) {
    const pharmacy = await this.prisma.pharmacy.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) throw new NotFoundException('Pharmacy not found');

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const p = await tx.pharmacy.update({
        where: { id: pharmacyId },
        data: { approvalStatus: PharmacyApprovalStatus.SUSPENDED, operationalStatus: 'CLOSED' },
      });
      await this.logAudit(tx, adminUserId, 'SUSPEND_PHARMACY', 'Pharmacy', pharmacyId);
      return p;
    });

    return { success: true, data: updated };
  }

  async approveDriver(adminUserId: string, driverId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const d = await tx.driver.update({
        where: { id: driverId },
        data: { approvalStatus: DriverApprovalStatus.APPROVED },
      });
      await this.logAudit(tx, adminUserId, 'APPROVE_DRIVER', 'Driver', driverId);
      return d;
    });

    return { success: true, data: updated };
  }

  async rejectDriver(adminUserId: string, driverId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const d = await tx.driver.update({
        where: { id: driverId },
        data: { approvalStatus: DriverApprovalStatus.REJECTED, availability: 'OFFLINE' },
      });
      await this.logAudit(tx, adminUserId, 'REJECT_DRIVER', 'Driver', driverId);
      return d;
    });

    return { success: true, data: updated };
  }

  async suspendDriver(adminUserId: string, driverId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const d = await tx.driver.update({
        where: { id: driverId },
        data: { approvalStatus: DriverApprovalStatus.SUSPENDED, availability: 'OFFLINE' },
      });
      await this.logAudit(tx, adminUserId, 'SUSPEND_DRIVER', 'Driver', driverId);
      return d;
    });

    return { success: true, data: updated };
  }

  async resolveException(adminUserId: string, orderId: string, resolutionNotes: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { deliveries: { include: { exception: true } } },
    });

    if (!order) throw new NotFoundException('Order not found');

    const delivery = order.deliveries[0];
    const exception = delivery?.exception;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (exception) {
        await tx.deliveryException.update({
          where: { id: exception.id },
          data: {
            status: 'RESOLVED',
            resolution: resolutionNotes,
            resolvedByUserId: adminUserId,
            resolvedAt: new Date(),
          },
        });
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      });

      if (delivery) {
        await tx.delivery.update({
          where: { id: delivery.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });

        if (delivery.driverId) {
          await tx.driver.update({
            where: { id: delivery.driverId },
            data: { availability: 'AVAILABLE' },
          });
        }
      }

      await this.logAudit(tx, adminUserId, 'RESOLVE_EXCEPTION', 'Order', orderId, { resolutionNotes });

      return { success: true, data: updatedOrder };
    });
  }

  async refundOrder(adminUserId: string, orderId: string, amount: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.payment.updateMany({
        where: { orderId },
        data: { status: 'REFUNDED' },
      });

      await this.logAudit(tx, adminUserId, 'REFUND_ORDER', 'Order', orderId, { amount });

      return { success: true, message: 'Order payment refunded successfully' };
    });
  }
}
