import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CustomerIdentityGuard } from '../identity/customer-identity.guard.js';
import { InternalIdentityGuard } from '../identity/internal-identity.guard.js';
import { ConsultationService } from './consultation.service.js';
import { CreateConsultationDto } from './dto/create-consultation.dto.js';
import { AssignConsultationDto } from './dto/assign-consultation.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto.js';

@Controller('consultations')
export class ConsultationController {
  constructor(private readonly consultationService: ConsultationService) {}

  @Post()
  @UseGuards(CustomerIdentityGuard)
  async create(
    @Headers('x-user-id') customerId: string,
    @Body() dto: CreateConsultationDto,
  ) {
    return this.consultationService.createConsultation(customerId, dto);
  }

  @Get()
  @UseGuards(InternalIdentityGuard) // Or customer guard depending on header/role
  async list(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.consultationService.getConsultationsForUser(userId, userRole || 'CUSTOMER');
  }

  @Get(':id')
  async getById(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
    @Param('id') id: string,
  ) {
    return this.consultationService.getConsultationById(userId, userRole || 'CUSTOMER', id);
  }

  @Post(':id/assign')
  @UseGuards(InternalIdentityGuard)
  async assign(
    @Headers('x-user-id') ownerUserId: string,
    @Param('id') id: string,
    @Body() dto: AssignConsultationDto,
  ) {
    return this.consultationService.assignConsultation(ownerUserId, id, dto);
  }

  @Post(':id/status')
  async updateStatus(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
    @Param('id') id: string,
    @Body() dto: UpdateConsultationStatusDto,
  ) {
    return this.consultationService.updateStatus(userId, userRole || 'CUSTOMER', id, dto);
  }

  @Get(':id/messages')
  async getMessages(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
    @Param('id') id: string,
  ) {
    return this.consultationService.getMessages(userId, userRole || 'CUSTOMER', id);
  }

  @Post(':id/messages')
  async sendMessage(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.consultationService.sendMessage(userId, userRole || 'CUSTOMER', id, dto.content);
  }
}
