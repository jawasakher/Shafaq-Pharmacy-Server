import { IsEnum, IsNotEmpty } from 'class-validator';
import { ConsultationStatus } from '@prisma/client';

export class UpdateConsultationStatusDto {
  @IsEnum(ConsultationStatus)
  @IsNotEmpty()
  status: ConsultationStatus;
}
