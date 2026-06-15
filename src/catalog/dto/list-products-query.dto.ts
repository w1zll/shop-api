import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

import { PRODUCTS_DEFAULT_LIMIT, PRODUCTS_MAX_LIMIT } from "../catalog.constants";

export const productSortValues = ["newest", "price-asc", "price-desc", "name-asc"] as const;

export type ProductSort = (typeof productSortValues)[number];

function transformBoolean(value: unknown) {
  if (value === "true" || value === true) {
    return true;
  }

  if (value === "false" || value === false) {
    return false;
  }

  return value;
}

export class ListProductsQueryDto {
  @ApiPropertyOptional({ example: "electronics" })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: "наушники" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: "AirBeat" })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ example: 100000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 1000000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => transformBoolean(value))
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ enum: productSortValues, default: "newest" })
  @IsOptional()
  @IsIn(productSortValues)
  sort?: ProductSort = "newest";

  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: PRODUCTS_DEFAULT_LIMIT,
    minimum: 1,
    maximum: PRODUCTS_MAX_LIMIT,
    default: PRODUCTS_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PRODUCTS_MAX_LIMIT)
  limit?: number = PRODUCTS_DEFAULT_LIMIT;
}
