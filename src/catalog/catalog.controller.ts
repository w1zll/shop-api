import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

import { CatalogService } from "./catalog.service";
import {
  CategoryDto,
  FeaturedProductsDto,
  ProductDto,
  ProductListDto,
  SearchSuggestionsDto,
} from "./dto/catalog-response.dto";
import { ListProductsQueryDto } from "./dto/list-products-query.dto";
import { SearchSuggestionsQueryDto } from "./dto/search-suggestions-query.dto";

@ApiTags("catalog")
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get("categories")
  @ApiOkResponse({ type: [CategoryDto] })
  getCategories() {
    return this.catalogService.getCategories();
  }

  @Get("categories/:slug")
  @ApiOkResponse({ type: CategoryDto })
  getCategoryBySlug(@Param("slug") slug: string) {
    return this.catalogService.getCategoryBySlug(slug);
  }

  @Get("products")
  @ApiOkResponse({ type: ProductListDto })
  getProducts(@Query() query: ListProductsQueryDto) {
    return this.catalogService.getProducts(query);
  }

  @Get("products/featured")
  @ApiOkResponse({ type: FeaturedProductsDto })
  getFeaturedProducts() {
    return this.catalogService.getFeaturedProducts();
  }

  @Get("products/search/suggestions")
  @ApiOkResponse({ type: SearchSuggestionsDto })
  getSearchSuggestions(@Query() query: SearchSuggestionsQueryDto) {
    return this.catalogService.getSearchSuggestions(query);
  }

  @Get("products/:slug")
  @ApiOkResponse({ type: ProductDto })
  getProductBySlug(@Param("slug") slug: string) {
    return this.catalogService.getProductBySlug(slug);
  }
}
