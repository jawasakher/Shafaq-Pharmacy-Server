import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ConsultationStatus,
  PharmacyMemberRole,
  PharmacyMemberStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateConsultationDto } from './dto/create-consultation.dto.js';
import { AssignConsultationDto } from './dto/assign-consultation.dto.js';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto.js';

@Injectable()
export class ConsultationService {
  private readonly logger = new Logger(ConsultationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createConsultation(customerId: string, dto: CreateConsultationDto) {
    const activeConsultation = await this.prisma.consultation.findFirst({
      where: {
        customerId,
        status: {
          in: [
            ConsultationStatus.REQUESTED,
            ConsultationStatus.ASSIGNED,
            ConsultationStatus.IN_PROGRESS,
            ConsultationStatus.WAITING_FOR_CUSTOMER,
          ],
        },
      },
    });

    if (activeConsultation) {
      throw new ConflictException('Customer already has an active consultation');
    }

    const consultation = await this.prisma.consultation.create({
      data: {
        customerId,
        symptoms: dto.symptoms,
        duration: dto.duration,
        age: dto.age,
        currentMedications: dto.currentMedications,
        allergies: dto.allergies,
        additionalDetails: dto.additionalDetails,
        status: ConsultationStatus.REQUESTED,
      },
    });

    return {
      success: true,
      data: consultation,
    };
  }

  async assignConsultation(ownerUserId: string, consultationId: string, dto: AssignConsultationDto) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    // Verify owner membership for the pharmacy
    const ownerMembership = await this.prisma.pharmacyMember.findFirst({
      where: {
        pharmacyId: dto.pharmacyId,
        userId: ownerUserId,
        role: PharmacyMemberRole.OWNER,
        status: PharmacyMemberStatus.ACTIVE,
      },
    });

    if (!ownerMembership) {
      throw new ForbiddenException('User is not an active owner of this pharmacy');
    }

    // Verify pharmacist membership in the same pharmacy
    const pharmacistMembership = await this.prisma.pharmacyMember.findFirst({
      where: {
        pharmacyId: dto.pharmacyId,
        userId: dto.pharmacistUserId,
        role: PharmacyMemberRole.PHARMACIST,
        status: PharmacyMemberStatus.ACTIVE,
      },
    });

    if (!pharmacistMembership) {
      throw new BadRequestException('Target user is not an active pharmacist in this pharmacy');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Unassign previous active assignment if any
      if (consultation.pharmacistId) {
        await tx.consultationAssignmentHistory.updateMany({
          where: {
            consultationId: consultation.id,
            pharmacistId: consultation.pharmacistId,
            unassignedAt: null,
          },
          data: { unassignedAt: new Date() },
        });
      }

      const updated = await tx.consultation.update({
        where: { id: consultationId },
        data: {
          pharmacistId: dto.pharmacistUserId,
          pharmacyId: dto.pharmacyId,
          status: ConsultationStatus.ASSIGNED,
        },
      });

      await tx.consultationAssignmentHistory.create({
        data: {
          consultationId: consultation.id,
          pharmacistId: dto.pharmacistUserId,
          assignedByUserId: ownerUserId,
          reason: 'Assigned by pharmacy owner',
        },
      });

      return {
        success: true,
        data: updated,
      };
    });
  }

  async getConsultationsForUser(userId: string, userRole: string) {
    let whereClause: Prisma.ConsultationWhereInput = {};

    if (userRole === 'CUSTOMER') {
      whereClause = { customerId: userId };
    } else if (userRole === 'PHARMACIST' || userRole === 'OWNER') {
      whereClause = { pharmacistId: userId };
    } else if (userRole === 'ADMIN') {
      whereClause = {};
    } else {
      throw new ForbiddenException('Access denied');
    }

    const consultations = await this.prisma.consultation.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        pharmacist: { select: { id: true, name: true, phone: true } },
      },
    });

    return {
      success: true,
      data: consultations,
    };
  }

  async getConsultationById(userId: string, userRole: string, consultationId: string) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        pharmacist: { select: { id: true, name: true, phone: true } },
        pharmacy: true,
      },
    });

    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    if (
      userRole === 'CUSTOMER' && consultation.customerId !== userId ||
      (userRole === 'PHARMACIST' || userRole === 'OWNER') && consultation.pharmacistId !== userId
    ) {
      throw new ForbiddenException('Access denied to this consultation');
    }

    return {
      success: true,
      data: consultation,
    };
  }

  async updateStatus(userId: string, userRole: string, consultationId: string, dto: UpdateConsultationStatusDto) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    if (
      userRole === 'CUSTOMER' && consultation.customerId !== userId ||
      (userRole === 'PHARMACIST' || userRole === 'OWNER') && consultation.pharmacistId !== userId
    ) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.prisma.consultation.update({
      where: { id: consultationId },
      data: { status: dto.status },
    });

    return {
      success: true,
      data: updated,
    };
  }

  async sendMessage(senderUserId: string, userRole: string, consultationId: string, content: string) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    // Strict chat access: only customer or assigned pharmacist can chat (SRS Section 47-48)
    const isCustomer = consultation.customerId === senderUserId;
    const isAssignedPharmacist = consultation.pharmacistId === senderUserId;

    if (!isCustomer && !isAssignedPharmacist) {
      throw new ForbiddenException('Only the consultation customer and assigned pharmacist can exchange messages');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        consultationId,
        senderId: senderUserId,
        content,
      },
    });

    if (consultation.status === ConsultationStatus.ASSIGNED) {
      await this.prisma.consultation.update({
        where: { id: consultationId },
        data: { status: ConsultationStatus.IN_PROGRESS },
      });
    }

    return {
      success: true,
      data: message,
    };
  }

  async getMessages(userId: string, userRole: string, consultationId: string) {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    const isCustomer = consultation.customerId === userId;
    const isAssignedPharmacist = consultation.pharmacistId === userId;

    if (!isCustomer && !isAssignedPharmacist && userRole !== 'ADMIN') {
      throw new ForbiddenException('Access denied to consultation messages');
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { consultationId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });

    return {
      success: true,
      data: messages,
    };
  }
}
