import { IsString, IsOptional, IsHexColor, MinLength, MaxLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  name: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class AddTagsToDrinkDto {
  @IsString({ each: true })
  tagIds: string[];
}
