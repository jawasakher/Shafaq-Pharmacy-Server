import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignConsultationDto {
  @IsUUID()
  @IsNotEmpty()
  pharmacistUserId: string;

  @IsUUID()
  @IsNotEmpty()
  pharmacyId: string;
}
