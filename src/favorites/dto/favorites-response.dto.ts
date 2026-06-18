import { ApiProperty } from "@nestjs/swagger";

export class FavoriteProductDto {
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

  @ApiProperty({ nullable: true })
  oldPriceCents!: number | null;

  @ApiProperty()
  stock!: number;

  @ApiProperty({ nullable: true })
  imageUrl!: string | null;
}

export class FavoriteDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: FavoriteProductDto })
  product!: FavoriteProductDto;
}

export class FavoritesListDto {
  @ApiProperty({ type: [FavoriteDto] })
  items!: FavoriteDto[];
}
