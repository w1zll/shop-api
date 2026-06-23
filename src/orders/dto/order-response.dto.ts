import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DeliveryMethod, OrderStatus, PaymentStatus } from "@prisma/client";

export class OrderItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  productSlug!: string;

  @ApiPropertyOptional({ nullable: true })
  productImage!: string | null;

  @ApiProperty()
  unitPriceCents!: number;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  totalCents!: number;
}

export class OrderDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  number!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus!: PaymentStatus;

  @ApiProperty()
  subtotalCents!: number;

  @ApiProperty()
  discountCents!: number;

  @ApiProperty()
  bonusSpentCents!: number;

  @ApiProperty()
  earnedBonusCents!: number;

  @ApiProperty()
  deliveryCents!: number;

  @ApiProperty()
  totalCents!: number;

  @ApiProperty({ enum: DeliveryMethod })
  deliveryMethod!: DeliveryMethod;

  @ApiProperty()
  deliveryAddress!: unknown;

  @ApiProperty({ type: [OrderItemDto] })
  items!: OrderItemDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class OrdersListDto {
  @ApiProperty({ type: [OrderDto] })
  items!: OrderDto[];

  @ApiProperty()
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
