import { IsISO8601, IsString } from 'class-validator';

export class PhotoMetadataDto {
  @IsISO8601()
  timestamp: string;

  @IsString()
  deviceId: string;
}