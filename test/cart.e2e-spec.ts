import jwt from "jsonwebtoken";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { UserRole } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { ACCESS_TOKEN_COOKIE, ANONYMOUS_CART_COOKIE, CSRF_TOKEN_COOKIE } from "../src/common/cookies";
import { PrismaService } from "../src/prisma/prisma.service";

const allowedOrigin = "http://localhost:3000";
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET ?? "change-me-access-token-secret";
const now = new Date("2026-01-01T00:00:00.000Z");

type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  priceCents: number;
  oldPriceCents: number | null;
  stock: number;
  isActive: boolean;
  images: Array<{ id: string; url: string; alt: string; position: number }>;
};

type CartRecord = {
  id: string;
  userId: string | null;
  anonymousId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CartItemRecord = {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
};

type CartResponseBody = {
  items: Array<{ id: string }>;
  summary: {
    totalQuantity: number;
    subtotalCents: number;
  };
};

function parseSetCookie(response: request.Response, name: string): string {
  const cookie = findSetCookie(response, name);

  if (!cookie) {
    throw new Error(`Cookie ${name} was not set`);
  }

  return cookie;
}

function findSetCookie(response: request.Response, name: string): string | undefined {
  const headers = response.headers as Record<string, string | string[] | undefined>;
  const setCookie = headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : [];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));

  return cookie?.split(";")[0];
}

function getCookieValue(cookie: string): string {
  const value = cookie.split("=")[1];

  if (!value) {
    throw new Error(`Cookie value is missing: ${cookie}`);
  }

  return value;
}

function createAccessCookie(userId: string) {
  const token = jwt.sign(
    {
      sub: userId,
      role: UserRole.USER,
      type: "access",
    },
    accessTokenSecret,
    { expiresIn: "15m" },
  );

  return `${ACCESS_TOKEN_COOKIE}=${token}`;
}

function createPrismaMock() {
  const products: ProductRecord[] = [
    {
      id: "product-1",
      name: "Demo Phone",
      slug: "demo-phone",
      brand: "Demo",
      priceCents: 100000,
      oldPriceCents: null,
      stock: 5,
      isActive: true,
      images: [{ id: "image-1", url: "https://example.com/phone.jpg", alt: "Demo Phone", position: 0 }],
    },
    {
      id: "product-2",
      name: "Inactive Product",
      slug: "inactive-product",
      brand: "Demo",
      priceCents: 200000,
      oldPriceCents: null,
      stock: 10,
      isActive: false,
      images: [],
    },
  ];
  const carts: CartRecord[] = [];
  const cartItems: CartItemRecord[] = [];

  function buildCart(cart: CartRecord) {
    return {
      ...cart,
      items: cartItems
        .filter((item) => item.cartId === cart.id)
        .map((item) => ({
          ...item,
          product: products.find((product) => product.id === item.productId),
        })),
    };
  }

  const prisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    $transaction: jest.fn().mockImplementation((callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma),
    ),
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    category: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    product: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockImplementation((args: { where: { id: string } }) => {
        const product = products.find((item) => item.id === args.where.id) ?? null;
        return Promise.resolve(product);
      }),
    },
    cart: {
      upsert: jest.fn().mockImplementation(
        (args: {
          where: { userId?: string | null; anonymousId?: string | null };
          create: { userId?: string; anonymousId?: string };
        }) => {
          const cart =
            carts.find(
              (item) =>
                (args.where.userId && item.userId === args.where.userId) ||
                (args.where.anonymousId && item.anonymousId === args.where.anonymousId),
            ) ??
            (() => {
              const created: CartRecord = {
                id: `cart-${String(carts.length + 1)}`,
                userId: args.create.userId ?? null,
                anonymousId: args.create.anonymousId ?? null,
                createdAt: now,
                updatedAt: now,
              };
              carts.push(created);
              return created;
            })();

          return Promise.resolve(buildCart(cart));
        },
      ),
      findUnique: jest.fn().mockImplementation(
        (args: { where: { id?: string; anonymousId?: string }; include?: unknown }) => {
          const cart =
            carts.find(
              (item) => item.id === args.where.id || item.anonymousId === args.where.anonymousId,
            ) ?? null;

          return Promise.resolve(cart ? buildCart(cart) : null);
        },
      ),
      delete: jest.fn().mockImplementation((args: { where: { id: string } }) => {
        const index = carts.findIndex((cart) => cart.id === args.where.id);

        if (index !== -1) {
          carts.splice(index, 1);
        }

        for (let index = cartItems.length - 1; index >= 0; index -= 1) {
          if (cartItems[index]?.cartId === args.where.id) {
            cartItems.splice(index, 1);
          }
        }

        return Promise.resolve({});
      }),
    },
    cartItem: {
      create: jest.fn().mockImplementation(
        (args: { data: { cartId: string; productId: string; quantity: number } }) => {
          const item: CartItemRecord = {
            id: `item-${String(cartItems.length + 1)}`,
            cartId: args.data.cartId,
            productId: args.data.productId,
            quantity: args.data.quantity,
            createdAt: now,
            updatedAt: now,
          };
          cartItems.push(item);
          return Promise.resolve(item);
        },
      ),
      update: jest.fn().mockImplementation(
        (args: { where: { id: string }; data: { quantity: number } }) => {
          const item = cartItems.find((cartItem) => cartItem.id === args.where.id);

          if (!item) {
            throw new Error("Cart item not found");
          }

          item.quantity = args.data.quantity;
          return Promise.resolve(item);
        },
      ),
      delete: jest.fn().mockImplementation((args: { where: { id: string } }) => {
        const index = cartItems.findIndex((item) => item.id === args.where.id);

        if (index !== -1) {
          cartItems.splice(index, 1);
        }

        return Promise.resolve({});
      }),
      deleteMany: jest.fn().mockImplementation((args: { where: { cartId: string } }) => {
        const beforeCount = cartItems.length;

        for (let index = cartItems.length - 1; index >= 0; index -= 1) {
          if (cartItems[index]?.cartId === args.where.cartId) {
            cartItems.splice(index, 1);
          }
        }

        return Promise.resolve({ count: beforeCount - cartItems.length });
      }),
    },
  };

  return {
    carts,
    cartItems,
    products,
    prisma,
  };
}

describe("Cart endpoints", () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let store: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    store = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(store.prisma)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    // Nest exposes the underlying HTTP server as `any`; Supertest accepts this server shape.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    server = app.getHttpServer();
  });

  afterEach(async () => {
    await app.close();
  });

  async function getCsrfCookie(): Promise<string> {
    const response = await request(server).get("/api/v1/auth/csrf").expect(200);

    return parseSetCookie(response, CSRF_TOKEN_COOKIE);
  }

  async function addProduct(quantity: number, cookies: string[] = []) {
    const csrfCookie = await getCsrfCookie();
    const csrfToken = getCookieValue(csrfCookie);
    const response = await request(server)
      .post("/api/v1/cart/items")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", [csrfCookie, ...cookies])
      .send({
        productId: "product-1",
        quantity,
      })
      .expect(201);

    return {
      response,
      anonymousCookie:
        findSetCookie(response, ANONYMOUS_CART_COOKIE) ?? (cookies.length > 0 ? cookies[0] : ""),
    };
  }

  it("creates anonymous cart and sets HttpOnly cookie", async () => {
    const response = await request(server).get("/api/v1/cart").expect(200);
    const anonymousCookie = parseSetCookie(response, ANONYMOUS_CART_COOKIE);

    expect(anonymousCookie).toContain(`${ANONYMOUS_CART_COOKIE}=`);
    expect(store.carts).toHaveLength(1);
    expect(response.body).toMatchObject({
      isAnonymous: true,
      items: [],
      summary: {
        itemsCount: 0,
        totalQuantity: 0,
        subtotalCents: 0,
      },
    });
  });

  it("adds product and returns cart summary", async () => {
    const { response } = await addProduct(2);

    expect(response.body).toMatchObject({
      items: [
        {
          productId: "product-1",
          quantity: 2,
          unitPriceCents: 100000,
          totalCents: 200000,
          product: {
            slug: "demo-phone",
            imageUrl: "https://example.com/phone.jpg",
          },
        },
      ],
      summary: {
        itemsCount: 1,
        totalQuantity: 2,
        subtotalCents: 200000,
      },
    });
  });

  it("updates, removes and clears cart items", async () => {
    const added = await addProduct(2);
    const itemId = (added.response.body as { items: Array<{ id: string }> }).items[0]?.id;
    const csrfCookie = await getCsrfCookie();
    const csrfToken = getCookieValue(csrfCookie);

    if (!itemId) {
      throw new Error("Cart item id is missing");
    }

    await request(server)
      .patch(`/api/v1/cart/items/${itemId}`)
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", [csrfCookie, added.anonymousCookie])
      .send({ quantity: 3 })
      .expect(200)
      .expect(({ body }) => {
        expect((body as CartResponseBody).summary).toMatchObject({
          totalQuantity: 3,
          subtotalCents: 300000,
        });
      });

    await request(server)
      .delete(`/api/v1/cart/items/${itemId}`)
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", [csrfCookie, added.anonymousCookie])
      .expect(200)
      .expect(({ body }) => {
        expect((body as CartResponseBody).summary).toMatchObject({
          totalQuantity: 0,
          subtotalCents: 0,
        });
      });

    await addProduct(1, [added.anonymousCookie]);

    await request(server)
      .delete("/api/v1/cart")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", [csrfCookie, added.anonymousCookie])
      .expect(200)
      .expect(({ body }) => {
        expect((body as CartResponseBody).items).toEqual([]);
      });
  });

  it("rejects inactive products and quantity above stock", async () => {
    const csrfCookie = await getCsrfCookie();
    const csrfToken = getCookieValue(csrfCookie);

    await request(server)
      .post("/api/v1/cart/items")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({ productId: "product-2", quantity: 1 })
      .expect(404);

    await request(server)
      .post("/api/v1/cart/items")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({ productId: "product-1", quantity: 6 })
      .expect(400);
  });

  it("merges anonymous cart into user cart", async () => {
    const added = await addProduct(2);
    const accessCookie = createAccessCookie("user-1");

    await request(server)
      .get("/api/v1/cart")
      .set("Cookie", [accessCookie, added.anonymousCookie])
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          isAnonymous: false,
          summary: {
            itemsCount: 1,
            totalQuantity: 2,
            subtotalCents: 200000,
          },
        });
      });

    expect(store.carts).toEqual([
      expect.objectContaining({
        userId: "user-1",
        anonymousId: null,
      }),
    ]);
  });

  it("rejects unsafe requests without CSRF token", async () => {
    await request(server)
      .post("/api/v1/cart/items")
      .set("Origin", allowedOrigin)
      .send({
        productId: "product-1",
        quantity: 1,
      })
      .expect(403);
  });
});
