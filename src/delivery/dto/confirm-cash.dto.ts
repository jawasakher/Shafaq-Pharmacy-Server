import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmCashDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  receivedAmount: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
