import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DeliveryMethod } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty()
  @IsString()
  city!: string;

  @ApiProperty()
  @IsString()
  street!: string;

  @ApiProperty()
  @IsString()
  house!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apartment?: string;

  @ApiProperty()
  @IsString()
  postalCode!: string;

  @ApiProperty({ enum: DeliveryMethod })
  @IsEnum(DeliveryMethod)
  deliveryMethod!: DeliveryMethod;

  @ApiPropertyOptional({ minimum: 0, maximum: 10_000_000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  bonusToSpend?: number;
}

export class MockPaymentDto {
  @ApiProperty()
  @IsString()
  idempotencyKey!: string;
}
