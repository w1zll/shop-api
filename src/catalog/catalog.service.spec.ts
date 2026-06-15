import { NotFoundException } from "@nestjs/common";

import { CatalogService } from "./catalog.service";
import { PrismaService } from "../prisma/prisma.service";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const updatedAt = new Date("2026-01-02T00:00:00.000Z");

const category = {
  id: "category-1",
  name: "Электроника",
  slug: "electronics",
  description: "Гаджеты",
  imageUrl: "https://example.com/category.jpg",
  parentId: null,
  createdAt,
  updatedAt,
  _count: {
    products: 2,
  },
};

const product = {
  id: "product-1",
  name: "Demo Phone",
  slug: "demo-phone",
  description: "Demo product",
  brand: "Demo",
  priceCents: 100000,
  oldPriceCents: null,
  stock: 5,
  isActive: true,
  isFeatured: true,
  attributes: { color: "black" },
  categoryId: "category-1",
  createdAt,
  updatedAt,
  category: {
    id: "category-1",
    name: "Электроника",
    slug: "electronics",
  },
  images: [
    {
      id: "image-1",
      url: "https://example.com/product.jpg",
      alt: "Demo Phone",
      position: 0,
    },
  ],
};

function createPrismaMock() {
  return {
    category: {
      findMany: jest.fn().mockResolvedValue([category]),
      findFirst: jest.fn().mockResolvedValue(category),
    },
    product: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest
        .fn()
        .mockResolvedValueOnce([product])
        .mockResolvedValueOnce([
          {
            brand: product.brand,
            priceCents: product.priceCents,
            stock: product.stock,
          },
        ]),
      findFirst: jest.fn().mockResolvedValue(product),
    },
  };
}

describe("CatalogService", () => {
  it("returns categories with active products count", async () => {
    const prisma = createPrismaMock();
    const service = new CatalogService(prisma as unknown as PrismaService);

    await expect(service.getCategories()).resolves.toEqual([
      {
        id: "category-1",
        name: "Электроника",
        slug: "electronics",
        description: "Гаджеты",
        imageUrl: "https://example.com/category.jpg",
        parentId: null,
        productsCount: 2,
      },
    ]);

    expect(prisma.category.findMany).toHaveBeenCalledWith({
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
  });

  it("builds products query with active filter, pagination and stable sorting", async () => {
    const prisma = createPrismaMock();
    const service = new CatalogService(prisma as unknown as PrismaService);

    await expect(
      service.getProducts({
        category: "electronics",
        search: "phone",
        brand: "Demo",
        minPrice: 50000,
        maxPrice: 150000,
        inStock: true,
        sort: "price-asc",
        page: 2,
        limit: 5,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          id: "product-1",
          priceCents: 100000,
        },
      ],
      pagination: {
        page: 2,
        limit: 5,
        total: 1,
        totalPages: 1,
      },
      availableFilters: {
        brands: ["Demo"],
        minPriceCents: 100000,
        maxPriceCents: 100000,
        hasInStock: true,
      },
    });

    expect(prisma.product.count).toHaveBeenCalledWith({
      where: {
        isActive: true,
        category: { slug: "electronics" },
        OR: [
          { name: { contains: "phone", mode: "insensitive" } },
          { description: { contains: "phone", mode: "insensitive" } },
          { brand: { contains: "phone", mode: "insensitive" } },
        ],
        brand: { equals: "Demo", mode: "insensitive" },
        priceCents: { gte: 50000, lte: 150000 },
        stock: { gt: 0 },
      },
    });
    expect(prisma.product.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderBy: [{ priceCents: "asc" }, { id: "asc" }],
        skip: 5,
        take: 5,
      }),
    );
  });

  it("throws when category is not found", async () => {
    const prisma = createPrismaMock();
    prisma.category.findFirst.mockResolvedValue(null);
    const service = new CatalogService(prisma as unknown as PrismaService);

    await expect(service.getCategoryBySlug("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns empty suggestions when query is blank", async () => {
    const prisma = createPrismaMock();
    const service = new CatalogService(prisma as unknown as PrismaService);

    await expect(service.getSearchSuggestions({ q: "   " })).resolves.toEqual({
      items: [],
    });
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });
});
