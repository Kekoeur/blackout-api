import { IsString, IsArray, ArrayMinSize, IsOptional, IsObject } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  barId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  drinkIds: string[];

  @IsOptional()
  @IsObject()
  assignments?: Record<string, Array<{ friendId: string | null; friendName: string }>>; // ⭐ CORRIGER
}
