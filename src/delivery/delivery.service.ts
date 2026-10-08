import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryOfferStatus,
  DeliveryStatus,
  DriverApprovalStatus,
  DriverAvailabilityStatus,
  OrderStatus,
  PharmacyAssignmentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async startDriverSearch(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        pharmacy: true,
        assignments: { where: { status: PharmacyAssignmentStatus.ACTIVE } },
        deliveries: {
          where: {
            status: {
              notIn: [DeliveryStatus.COMPLETED, DeliveryStatus.EXCEPTION],
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.deliveries.length > 0) {
      throw new ConflictException('Active delivery already exists for this order');
    }

    if (order.status !== OrderStatus.READY_FOR_PICKUP && order.status !== OrderStatus.PAID) {
      throw new BadRequestException(
        `Order is not ready for delivery search. Current status: ${order.status}`,
      );
    }

    const availableDrivers = await this.prisma.driver.findMany({
      where: {
        approvalStatus: DriverApprovalStatus.APPROVED,
        availability: DriverAvailabilityStatus.AVAILABLE,
      },
    });

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (order.status !== OrderStatus.IN_DELIVERY) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.IN_DELIVERY },
        });
      }

      const delivery = await tx.delivery.create({
        data: {
          orderId: order.id,
          status: DeliveryStatus.SEARCHING_FOR_DRIVER,
          pickupAddress: order.pharmacy.address || 'Pharmacy Location',
          pickupLatitude: order.pharmacy.latitude,
          pickupLongitude: order.pharmacy.longitude,
          dropoffAddress: order.deliveryAddress,
          dropoffLatitude: order.deliveryLatitude,
          dropoffLongitude: order.deliveryLongitude,
        },
      });

      if (availableDrivers.length > 0) {
        await tx.deliveryOffer.createMany({
          data: availableDrivers.map((driver) => ({
            deliveryId: delivery.id,
            driverId: driver.id,
            status: DeliveryOfferStatus.OFFERED,
          })),
        });
      }

      return {
        success: true,
        deliveryId: delivery.id,
        status: delivery.status,
        offersCreated: availableDrivers.length,
      };
    });
  }

  async acceptOffer(driverUserId: string, offerId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId: driverUserId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    if (
      driver.approvalStatus !== DriverApprovalStatus.APPROVED ||
      driver.availability !== DriverAvailabilityStatus.AVAILABLE
    ) {
      throw new BadRequestException('Driver is not approved or available');
    }

    const offer = await this.prisma.deliveryOffer.findUnique({
      where: { id: offerId },
      include: { delivery: true },
    });

    if (!offer) {
      throw new NotFoundException('Delivery offer not found');
    }

    if (offer.driverId !== driver.id) {
      throw new ForbiddenException('Offer does not belong to this driver');
    }

    if (offer.status !== DeliveryOfferStatus.OFFERED) {
      throw new BadRequestException(`Offer is no longer valid. Current status: ${offer.status}`);
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const delivery = await tx.delivery.findUnique({
        where: { id: offer.deliveryId },
      });

      if (!delivery || delivery.status !== DeliveryStatus.SEARCHING_FOR_DRIVER) {
        throw new ConflictException('Delivery is no longer available for assignment');
      }

      await tx.deliveryOffer.update({
        where: { id: offer.id },
        data: {
          status: DeliveryOfferStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      await tx.deliveryOffer.updateMany({
        where: {
          deliveryId: delivery.id,
          id: { not: offer.id },
          status: DeliveryOfferStatus.OFFERED,
        },
        data: {
          status: DeliveryOfferStatus.CANCELLED,
        },
      });

      const updatedDelivery = await tx.delivery.update({
        where: { id: delivery.id },
        data: {
          driverId: driver.id,
          status: DeliveryStatus.DRIVER_ASSIGNED,
          startedAt: new Date(),
        },
      });

      await tx.driver.update({
        where: { id: driver.id },
        data: {
          availability: DriverAvailabilityStatus.BUSY,
        },
      });

      return {
        success: true,
        deliveryId: updatedDelivery.id,
        driverId: driver.id,
        status: updatedDelivery.status,
      };
    });
  }

  async rejectOffer(driverUserId: string, offerId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId: driverUserId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const offer = await this.prisma.deliveryOffer.findUnique({
      where: { id: offerId },
    });

    if (!offer) {
      throw new NotFoundException('Delivery offer not found');
    }

    if (offer.driverId !== driver.id) {
      throw new ForbiddenException('Offer does not belong to this driver');
    }

    await this.prisma.deliveryOffer.update({
      where: { id: offer.id },
      data: {
        status: DeliveryOfferStatus.REJECTED,
        rejectedAt: new Date(),
      },
    });

    return { success: true, offerId: offer.id, status: DeliveryOfferStatus.REJECTED };
  }

  async getDriverOffers(driverUserId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId: driverUserId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const offers = await this.prisma.deliveryOffer.findMany({
      where: {
        driverId: driver.id,
        status: DeliveryOfferStatus.OFFERED,
      },
      include: {
        delivery: {
          include: { order: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: offers.map((o) => ({
        offerId: o.id,
        deliveryId: o.deliveryId,
        orderId: o.delivery.orderId,
        pickupAddress: o.delivery.pickupAddress,
        dropoffAddress: o.delivery.dropoffAddress,
        status: o.status,
        offeredAt: o.offeredAt,
      })),
    };
  }

  async updateDeliveryStatus(
    driverUserId: string,
    deliveryId: string,
    newStatus: DeliveryStatus,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId: driverUserId },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    if (delivery.driverId !== driver.id) {
      throw new ForbiddenException('Delivery does not belong to this driver');
    }

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: newStatus,
        pickedUpAt: newStatus === DeliveryStatus.PICKED_UP ? new Date() : delivery.pickedUpAt,
        deliveredAt: newStatus === DeliveryStatus.DELIVERED ? new Date() : delivery.deliveredAt,
        completedAt: newStatus === DeliveryStatus.COMPLETED ? new Date() : delivery.completedAt,
      },
    });

    return { success: true, deliveryId: updated.id, status: updated.status };
  }

  async getDeliveryById(userId: string, deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: true, driver: { include: { user: true } } },
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    return {
      success: true,
      data: {
        id: delivery.id,
        orderId: delivery.orderId,
        driverId: delivery.driverId,
        driverName: delivery.driver?.user.name || null,
        status: delivery.status,
        pickupAddress: delivery.pickupAddress,
        dropoffAddress: delivery.dropoffAddress,
        startedAt: delivery.startedAt,
        pickedUpAt: delivery.pickedUpAt,
        deliveredAt: delivery.deliveredAt,
        completedAt: delivery.completedAt,
      },
    };
  }
}
