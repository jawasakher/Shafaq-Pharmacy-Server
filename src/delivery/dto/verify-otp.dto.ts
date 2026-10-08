import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}
