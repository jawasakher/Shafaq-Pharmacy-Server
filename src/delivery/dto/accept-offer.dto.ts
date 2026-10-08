import { IsNotEmpty, IsUUID } from 'class-validator';

export class AcceptOfferDto {
  @IsUUID()
  @IsNotEmpty()
  offerId: string;
}
