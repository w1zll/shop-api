import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CategoryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  parentId!: string | null;

  @ApiProperty()
  productsCount!: number;
}

export class ProductImageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  alt!: string;

  @ApiProperty()
  position!: number;
}

export class ProductCategoryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class ProductDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  brand!: string;

  @ApiProperty()
  priceCents!: number;

  @ApiPropertyOptional({ nullable: true })
  oldPriceCents!: number | null;

  @ApiProperty()
  stock!: number;

  @ApiProperty()
  isFeatured!: boolean;

  @ApiProperty()
  attributes!: unknown;

  @ApiProperty({ type: ProductCategoryDto })
  category!: ProductCategoryDto;

  @ApiProperty({ type: [ProductImageDto] })
  images!: ProductImageDto[];
}

export class PaginationDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class AvailableFiltersDto {
  @ApiProperty({ type: [String] })
  brands!: string[];

  @ApiPropertyOptional({ nullable: true })
  minPriceCents!: number | null;

  @ApiPropertyOptional({ nullable: true })
  maxPriceCents!: number | null;

  @ApiProperty()
  hasInStock!: boolean;
}

export class ProductListDto {
  @ApiProperty({ type: [ProductDto] })
  items!: ProductDto[];

  @ApiProperty({ type: PaginationDto })
  pagination!: PaginationDto;

  @ApiProperty({ type: AvailableFiltersDto })
  availableFilters!: AvailableFiltersDto;
}

export class FeaturedProductsDto {
  @ApiProperty({ type: [ProductDto] })
  items!: ProductDto[];
}

export class SearchSuggestionDto {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  brand!: string;
}

export class SearchSuggestionsDto {
  @ApiProperty({ type: [SearchSuggestionDto] })
  items!: SearchSuggestionDto[];
}
