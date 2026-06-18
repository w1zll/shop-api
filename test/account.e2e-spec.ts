import jwt from "jsonwebtoken";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DeliveryMethod, OrderStatus, PaymentStatus, Prisma, User, UserRole } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { ACCESS_TOKEN_COOKIE, CSRF_TOKEN_COOKIE } from "../src/common/cookies";
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
  images: Array<{ url: string; position: number }>;
};

type FavoriteRecord = {
  id: string;
  userId: string;
  productId: string;
  createdAt: Date;
};

type OrderRecord = {
  id: string;
  number: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotalCents: number;
  discountCents: number;
  bonusSpentCents: number;
  deliveryCents: number;
  totalCents: number;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function parseSetCookie(response: request.Response, name: string): string {
  const headers = response.headers as Record<string, string | string[] | undefined>;
  const setCookie = headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : [];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));

  if (!cookie) {
    throw new Error(`Cookie ${name} was not set`);
  }

  return cookie.split(";")[0];
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
  const users: User[] = [
    {
      id: "user-1",
      email: "demo@example.com",
      passwordHash: "hash",
      name: "Demo User",
      avatarUrl: null,
      bonusBalanceCents: 50_000,
      role: UserRole.USER,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "user-2",
      email: "other@example.com",
      passwordHash: "hash",
      name: "Other User",
      avatarUrl: null,
      bonusBalanceCents: 0,
      role: UserRole.USER,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const products: ProductRecord[] = [
    {
      id: "product-1",
      name: "Demo Phone",
      slug: "demo-phone",
      brand: "Demo",
      priceCents: 100_000,
      oldPriceCents: null,
      stock: 5,
      isActive: true,
      images: [{ url: "https://example.com/phone.jpg", position: 0 }],
    },
  ];
  const favorites: FavoriteRecord[] = [];
  const orders: OrderRecord[] = [
    {
      id: "order-1",
      number: "ORD-1",
      userId: "user-1",
      status: OrderStatus.PAID,
      paymentStatus: PaymentStatus.SUCCEEDED,
      subtotalCents: 100_000,
      discountCents: 0,
      bonusSpentCents: 0,
      deliveryCents: 0,
      totalCents: 100_000,
      deliveryMethod: DeliveryMethod.PICKUP,
      deliveryAddress: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "order-2",
      number: "ORD-2",
      userId: "user-1",
      status: OrderStatus.PAID,
      paymentStatus: PaymentStatus.SUCCEEDED,
      subtotalCents: 200_000,
      discountCents: 0,
      bonusSpentCents: 0,
      deliveryCents: 0,
      totalCents: 200_000,
      deliveryMethod: DeliveryMethod.PICKUP,
      deliveryAddress: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "order-other",
      number: "ORD-OTHER",
      userId: "user-2",
      status: OrderStatus.PAID,
      paymentStatus: PaymentStatus.SUCCEEDED,
      subtotalCents: 300_000,
      discountCents: 0,
      bonusSpentCents: 0,
      deliveryCents: 0,
      totalCents: 300_000,
      deliveryMethod: DeliveryMethod.PICKUP,
      deliveryAddress: {},
      createdAt: now,
      updatedAt: now,
    },
  ];

  function buildFavorite(favorite: FavoriteRecord) {
    return {
      ...favorite,
      product: products.find((product) => product.id === favorite.productId),
    };
  }

  function buildOrder(order: OrderRecord) {
    return {
      ...order,
      items: [],
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
      findUnique: jest.fn().mockImplementation((args: { where: { id?: string; email?: string } }) =>
        Promise.resolve(
          users.find((user) => user.id === args.where.id || user.email === args.where.email) ?? null,
        ),
      ),
      update: jest.fn().mockImplementation((args: { where: { id: string }; data: Partial<User> }) => {
        const user = users.find((item) => item.id === args.where.id);

        if (!user) {
          throw new Error("User not found");
        }

        Object.assign(user, args.data, { updatedAt: now });
        return Promise.resolve(user);
      }),
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
      findUnique: jest.fn().mockImplementation((args: { where: { id: string } }) =>
        Promise.resolve(products.find((product) => product.id === args.where.id) ?? null),
      ),
    },
    favorite: {
      findMany: jest.fn().mockImplementation((args: { where: { userId: string } }) =>
        Promise.resolve(favorites.filter((favorite) => favorite.userId === args.where.userId).map(buildFavorite)),
      ),
      create: jest.fn().mockImplementation((args: { data: { userId: string; productId: string } }) => {
        if (
          favorites.some(
            (favorite) =>
              favorite.userId === args.data.userId && favorite.productId === args.data.productId,
          )
        ) {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            clientVersion: "test",
            code: "P2002",
          });
        }

        const favorite: FavoriteRecord = {
          id: `favorite-${String(favorites.length + 1)}`,
          userId: args.data.userId,
          productId: args.data.productId,
          createdAt: now,
        };
        favorites.push(favorite);

        return Promise.resolve(buildFavorite(favorite));
      }),
      deleteMany: jest.fn().mockImplementation((args: { where: { userId: string; productId: string } }) => {
        const beforeCount = favorites.length;

        for (let index = favorites.length - 1; index >= 0; index -= 1) {
          if (
            favorites[index]?.userId === args.where.userId &&
            favorites[index]?.productId === args.where.productId
          ) {
            favorites.splice(index, 1);
          }
        }

        return Promise.resolve({ count: beforeCount - favorites.length });
      }),
    },
    order: {
      count: jest.fn().mockImplementation((args: { where: { userId: string } }) =>
        Promise.resolve(orders.filter((order) => order.userId === args.where.userId).length),
      ),
      findMany: jest.fn().mockImplementation((args: { where: { userId: string }; skip?: number; take?: number }) =>
        Promise.resolve(
          orders
            .filter((order) => order.userId === args.where.userId)
            .slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? orders.length))
            .map(buildOrder),
        ),
      ),
      findUnique: jest.fn().mockImplementation((args: { where: { id: string } }) => {
        const order = orders.find((item) => item.id === args.where.id) ?? null;

        return Promise.resolve(order ? buildOrder(order) : null);
      }),
    },
  };

  return {
    favorites,
    prisma,
    users,
  };
}

describe("Account API endpoints", () => {
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

  async function getCsrfHeaders() {
    const csrfCookie = await getCsrfCookie();
    const csrfToken = getCookieValue(csrfCookie);

    return { csrfCookie, csrfToken };
  }

  it("rejects account endpoints without authorization", async () => {
    await request(server).get("/api/v1/users/me").expect(401);
    await request(server).get("/api/v1/favorites").expect(401);
    await request(server).get("/api/v1/orders").expect(401);
  });

  it("returns and updates profile", async () => {
    const { csrfCookie, csrfToken } = await getCsrfHeaders();
    const accessCookie = createAccessCookie("user-1");

    await request(server)
      .get("/api/v1/users/me")
      .set("Cookie", accessCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          user: {
            email: "demo@example.com",
            name: "Demo User",
          },
        });
      });

    await request(server)
      .patch("/api/v1/users/me")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", [csrfCookie, accessCookie])
      .send({
        avatarUrl: "https://example.com/avatar.png",
        name: "Updated User",
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          user: {
            avatarUrl: "https://example.com/avatar.png",
            name: "Updated User",
          },
        });
      });

    expect(store.users[0]?.name).toBe("Updated User");
  });

  it("adds, rejects duplicate and removes favorite", async () => {
    const { csrfCookie, csrfToken } = await getCsrfHeaders();
    const accessCookie = createAccessCookie("user-1");
    const cookies = [csrfCookie, accessCookie];

    await request(server)
      .post("/api/v1/favorites/product-1")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", cookies)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          productId: "product-1",
          product: {
            slug: "demo-phone",
          },
        });
      });

    await request(server)
      .post("/api/v1/favorites/product-1")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", cookies)
      .expect(409);

    await request(server)
      .get("/api/v1/favorites")
      .set("Cookie", accessCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          items: [
            {
              productId: "product-1",
            },
          ],
        });
      });

    await request(server)
      .delete("/api/v1/favorites/product-1")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", cookies)
      .expect(200);

    expect(store.favorites).toEqual([]);
  });

  it("paginates orders and hides another user's order", async () => {
    const accessCookie = createAccessCookie("user-1");

    await request(server)
      .get("/api/v1/orders?page=1&limit=1")
      .set("Cookie", accessCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          items: [{ id: "order-1" }],
          pagination: {
            page: 1,
            limit: 1,
            total: 2,
            totalPages: 2,
          },
        });
      });

    await request(server)
      .get("/api/v1/orders/order-other")
      .set("Cookie", accessCookie)
      .expect(404);
  });
});
