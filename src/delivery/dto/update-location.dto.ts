import { IsNumber, IsOptional, IsUUID } from 'class-validator';

export class UpdateLocationDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsNumber()
  heading?: number;

  @IsOptional()
  @IsNumber()
  speed?: number;

  @IsOptional()
  @IsUUID()
  deliveryId?: string;
}
