import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  PRODUCTS_DEFAULT_LIMIT,
  PRODUCTS_MAX_LIMIT,
  SEARCH_SUGGESTIONS_DEFAULT_LIMIT,
  SEARCH_SUGGESTIONS_MAX_LIMIT,
} from "./catalog.constants";
import { ListProductsQueryDto, ProductSort } from "./dto/list-products-query.dto";
import { SearchSuggestionsQueryDto } from "./dto/search-suggestions-query.dto";
import { PrismaService } from "../prisma/prisma.service";

const productInclude = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  images: {
    orderBy: {
      position: "asc",
    },
    select: {
      id: true,
      url: true,
      alt: true,
      position: true,
    },
  },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

type CategoryWithCount = Prisma.CategoryGetPayload<{
  include: {
    _count: {
      select: {
        products: true;
      };
    };
  };
}>;

function normalizeText(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function getProductOrderBy(sort: ProductSort = "newest"): Prisma.ProductOrderByWithRelationInput[] {
  if (sort === "price-asc") {
    return [{ priceCents: "asc" }, { id: "asc" }];
  }

  if (sort === "price-desc") {
    return [{ priceCents: "desc" }, { id: "asc" }];
  }

  if (sort === "name-asc") {
    return [{ name: "asc" }, { id: "asc" }];
  }

  return [{ createdAt: "desc" }, { id: "asc" }];
}

function buildProductWhere(query: ListProductsQueryDto): Prisma.ProductWhereInput {
  const search = normalizeText(query.search);
  const category = normalizeText(query.category);
  const brand = normalizeText(query.brand);
  const priceCents: Prisma.IntFilter = {};
  const where: Prisma.ProductWhereInput = {
    isActive: true,
  };

  if (category) {
    where.category = { slug: category };
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { brand: { contains: search, mode: "insensitive" } },
    ];
  }

  if (brand) {
    where.brand = { equals: brand, mode: "insensitive" };
  }

  if (query.minPrice !== undefined) {
    priceCents.gte = query.minPrice;
  }

  if (query.maxPrice !== undefined) {
    priceCents.lte = query.maxPrice;
  }

  if (priceCents.gte !== undefined || priceCents.lte !== undefined) {
    where.priceCents = priceCents;
  }

  if (query.inStock === true) {
    where.stock = { gt: 0 };
  }

  if (query.inStock === false) {
    where.stock = { equals: 0 };
  }

  return where;
}

function mapCategory(category: CategoryWithCount) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.imageUrl,
    parentId: category.parentId,
    productsCount: category._count.products,
  };
}

function mapProduct(product: ProductWithRelations) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    brand: product.brand,
    priceCents: product.priceCents,
    oldPriceCents: product.oldPriceCents,
    stock: product.stock,
    isFeatured: product.isFeatured,
    attributes: product.attributes,
    category: product.category,
    images: product.images,
  };
}

function buildAvailableFilters(
  products: Array<Pick<ProductWithRelations, "brand" | "priceCents" | "stock">>,
) {
  const brands = [...new Set(products.map((product) => product.brand))].sort((left, right) =>
    left.localeCompare(right, "ru"),
  );
  const prices = products.map((product) => product.priceCents);

  return {
    brands,
    minPriceCents: prices.length > 0 ? Math.min(...prices) : null,
    maxPriceCents: prices.length > 0 ? Math.max(...prices) : null,
    hasInStock: products.some((product) => product.stock > 0),
  };
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories() {
    const categories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: {
            products: {
              where: {
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: [{ parentId: "asc" }, { name: "asc" }, { id: "asc" }],
    });

    return categories.map(mapCategory);
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug },
      include: {
        _count: {
          select: {
            products: {
              where: {
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException("Category not found");
    }

    return mapCategory(category);
  }

  async getProducts(query: ListProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? PRODUCTS_DEFAULT_LIMIT, PRODUCTS_MAX_LIMIT);
    const where = buildProductWhere(query);
    const skip = (page - 1) * limit;

    const [total, products, filterProducts] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: getProductOrderBy(query.sort),
        skip,
        take: limit,
      }),
      this.prisma.product.findMany({
        where,
        select: {
          brand: true,
          priceCents: true,
          stock: true,
        },
      }),
    ]);

    return {
      items: products.map(mapProduct),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      availableFilters: buildAvailableFilters(filterProducts),
    };
  }

  async getFeaturedProducts() {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        isFeatured: true,
      },
      include: productInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: PRODUCTS_MAX_LIMIT,
    });

    return {
      items: products.map(mapProduct),
    };
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        isActive: true,
      },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return mapProduct(product);
  }

  async getSearchSuggestions(query: SearchSuggestionsQueryDto) {
    const search = normalizeText(query.q);
    const limit = Math.min(
      query.limit ?? SEARCH_SUGGESTIONS_DEFAULT_LIMIT,
      SEARCH_SUGGESTIONS_MAX_LIMIT,
    );

    if (!search) {
      return {
        items: [],
      };
    }

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { brand: { contains: search, mode: "insensitive" } },
        ],
      },
      select: {
        name: true,
        slug: true,
        brand: true,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit,
    });

    return {
      items: products.map((product) => ({
        label: product.name,
        slug: product.slug,
        brand: product.brand,
      })),
    };
  }
}
