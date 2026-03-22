import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum MenuConditionType {
  COMPLETION_PERCENT = 'COMPLETION_PERCENT',
  DAY_OF_WEEK = 'DAY_OF_WEEK',
  MONTH = 'MONTH',
  SEASON = 'SEASON',
}

export class MenuConditionDto {
  @IsEnum(MenuConditionType)
  conditionType: MenuConditionType;

  @IsOptional()
  @IsNumber()
  completionPercent?: number;

  @IsOptional()
  @IsString()
  completionBarId?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  daysOfWeek?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  months?: number[];

  @IsOptional()
  @IsString()
  season?: string;
}

export class CreateMenuDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuConditionDto)
  conditions?: MenuConditionDto[];
}

export class UpdateMenuDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}

export class AddMenuItemDto {
  @IsString()
  menuDrinkId: string;

  @IsOptional()
  @IsNumber()
  displayOrder?: number;
}
