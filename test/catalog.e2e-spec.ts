import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { PrismaService } from "../src/prisma/prisma.service";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const updatedAt = new Date("2026-01-02T00:00:00.000Z");

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
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    category: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "category-1",
          name: "Электроника",
          slug: "electronics",
          description: "Гаджеты",
          imageUrl: "https://example.com/category.jpg",
          parentId: null,
          createdAt,
          updatedAt,
          _count: {
            products: 1,
          },
        },
      ]),
      findFirst: jest.fn().mockImplementation((args: unknown) => {
        const slug = (args as { where?: { slug?: string } }).where?.slug;

        if (slug === "missing") {
          return Promise.resolve(null);
        }

        return Promise.resolve({
          id: "category-1",
          name: "Электроника",
          slug: "electronics",
          description: "Гаджеты",
          imageUrl: "https://example.com/category.jpg",
          parentId: null,
          createdAt,
          updatedAt,
          _count: {
            products: 1,
          },
        });
      }),
    },
    product: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockImplementation((args: unknown) => {
        const query = args as {
          select?: { brand?: boolean; name?: boolean; priceCents?: boolean; stock?: boolean };
          where?: { isFeatured?: boolean };
        };

        if (query.select?.name) {
          return Promise.resolve([
            {
              name: product.name,
              slug: product.slug,
              brand: product.brand,
            },
          ]);
        }

        if (query.select?.brand || query.select?.priceCents || query.select?.stock) {
          return Promise.resolve([
            {
              brand: product.brand,
              priceCents: product.priceCents,
              stock: product.stock,
            },
          ]);
        }

        return Promise.resolve([product]);
      }),
      findFirst: jest.fn().mockImplementation((args: unknown) => {
        const slug = (args as { where?: { slug?: string } }).where?.slug;

        if (slug === "missing") {
          return Promise.resolve(null);
        }

        return Promise.resolve(product);
      }),
    },
  };
}

describe("Catalog endpoints", () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    // Nest exposes the underlying HTTP server as `any`; Supertest accepts this server shape.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/categories", async () => {
    await request(server)
      .get("/api/v1/categories")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            slug: "electronics",
            productsCount: 1,
          }),
        ]);
      });
  });

  it("GET /api/v1/products returns list contract", async () => {
    await request(server)
      .get("/api/v1/products?category=electronics&sort=price-asc&page=1&limit=5&inStock=true")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          items: [
            {
              slug: "demo-phone",
              priceCents: 100000,
            },
          ],
          pagination: {
            page: 1,
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
      });
  });

  it("GET /api/v1/products rejects limit above maximum", async () => {
    await request(server).get("/api/v1/products?limit=51").expect(400);
  });

  it("GET /api/v1/products/featured", async () => {
    await request(server)
      .get("/api/v1/products/featured")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          items: [
            {
              slug: "demo-phone",
            },
          ],
        });
      });
  });

  it("GET /api/v1/products/search/suggestions", async () => {
    await request(server)
      .get("/api/v1/products/search/suggestions?q=phone")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          items: [
            {
              label: "Demo Phone",
              slug: "demo-phone",
              brand: "Demo",
            },
          ],
        });
      });
  });

  it("GET /api/v1/products/:slug returns 404 for inactive or missing products", async () => {
    await request(server).get("/api/v1/products/missing").expect(404);
  });
});
