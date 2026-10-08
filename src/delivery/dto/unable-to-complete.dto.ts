import { IsNotEmpty, IsString } from 'class-validator';

export class UnableToCompleteDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
