import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CartProductDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  brand!: string;

  @ApiProperty()
  priceCents!: number;

  @ApiPropertyOptional({ nullable: true })
  oldPriceCents!: number | null;

  @ApiProperty()
  stock!: number;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;
}

export class CartItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  unitPriceCents!: number;

  @ApiProperty()
  totalCents!: number;

  @ApiProperty({ type: CartProductDto })
  product!: CartProductDto;
}

export class CartSummaryDto {
  @ApiProperty()
  itemsCount!: number;

  @ApiProperty()
  totalQuantity!: number;

  @ApiProperty()
  subtotalCents!: number;
}

export class CartDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  isAnonymous!: boolean;

  @ApiProperty({ type: [CartItemDto] })
  items!: CartItemDto[];

  @ApiProperty({ type: CartSummaryDto })
  summary!: CartSummaryDto;
}
