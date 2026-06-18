import jwt from "jsonwebtoken";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  DeliveryMethod,
  OrderStatus,
  PaymentStatus,
  User,
  UserRole,
} from "@prisma/client";
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
  priceCents: number;
  stock: number;
  isActive: boolean;
  images: Array<{ url: string; position: number }>;
};

type CartRecord = {
  id: string;
  userId: string;
};

type CartItemRecord = {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
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

type OrderItemRecord = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string | null;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
};

type PaymentRecord = {
  id: string;
  orderId: string;
  userId: string;
  status: PaymentStatus;
  amountCents: number;
  idempotencyKey: string;
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
      priceCents: 100_000,
      stock: 5,
      isActive: true,
      images: [{ url: "https://example.com/phone.jpg", position: 0 }],
    },
  ];
  const carts: CartRecord[] = [{ id: "cart-1", userId: "user-1" }];
  const cartItems: CartItemRecord[] = [
    {
      id: "cart-item-1",
      cartId: "cart-1",
      productId: "product-1",
      quantity: 2,
      createdAt: now,
    },
  ];
  const orders: OrderRecord[] = [];
  const orderItems: OrderItemRecord[] = [];
  const payments: PaymentRecord[] = [];

  function buildCart(cart: CartRecord) {
    return {
      ...cart,
      anonymousId: null,
      createdAt: now,
      updatedAt: now,
      items: cartItems
        .filter((item) => item.cartId === cart.id)
        .map((item) => ({
          ...item,
          updatedAt: now,
          product: products.find((product) => product.id === item.productId),
        })),
    };
  }

  function buildOrder(order: OrderRecord) {
    return {
      ...order,
      items: orderItems.filter((item) => item.orderId === order.id),
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
      update: jest.fn().mockImplementation(
        (args: {
          where: { id: string };
          data: { bonusBalanceCents?: { decrement?: number; increment?: number } };
        }) => {
          const user = users.find((item) => item.id === args.where.id);

          if (!user) {
            throw new Error("User not found");
          }

          user.bonusBalanceCents -= args.data.bonusBalanceCents?.decrement ?? 0;
          user.bonusBalanceCents += args.data.bonusBalanceCents?.increment ?? 0;

          return Promise.resolve(user);
        },
      ),
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
      findUnique: jest.fn(),
      updateMany: jest.fn().mockImplementation(
        (args: {
          where: { id: string; isActive: boolean; stock: { gte: number } };
          data: { stock: { decrement: number } };
        }) => {
          const product = products.find((item) => item.id === args.where.id);

          if (!product || product.isActive !== args.where.isActive || product.stock < args.where.stock.gte) {
            return Promise.resolve({ count: 0 });
          }

          product.stock -= args.data.stock.decrement;
          return Promise.resolve({ count: 1 });
        },
      ),
    },
    cart: {
      findUnique: jest.fn().mockImplementation((args: { where: { userId?: string }; select?: { id: boolean } }) => {
        const cart = carts.find((item) => item.userId === args.where.userId) ?? null;

        if (!cart) {
          return Promise.resolve(null);
        }

        if (args.select?.id) {
          return Promise.resolve({ id: cart.id });
        }

        return Promise.resolve(buildCart(cart));
      }),
    },
    cartItem: {
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
    order: {
      count: jest.fn().mockImplementation((args: { where: { userId: string } }) =>
        Promise.resolve(orders.filter((order) => order.userId === args.where.userId).length),
      ),
      create: jest.fn().mockImplementation(
        (args: {
          data: Omit<OrderRecord, "id" | "createdAt" | "updatedAt"> & {
            items: { create: Array<Omit<OrderItemRecord, "id" | "orderId">> };
          };
        }) => {
          const order: OrderRecord = {
            id: `order-${String(orders.length + 1)}`,
            number: args.data.number,
            userId: args.data.userId,
            status: args.data.status,
            paymentStatus: args.data.paymentStatus,
            subtotalCents: args.data.subtotalCents,
            discountCents: args.data.discountCents,
            bonusSpentCents: args.data.bonusSpentCents,
            deliveryCents: args.data.deliveryCents,
            totalCents: args.data.totalCents,
            deliveryMethod: args.data.deliveryMethod,
            deliveryAddress: args.data.deliveryAddress,
            createdAt: now,
            updatedAt: now,
          };
          orders.push(order);

          for (const item of args.data.items.create) {
            orderItems.push({
              ...item,
              id: `order-item-${String(orderItems.length + 1)}`,
              orderId: order.id,
            });
          }

          return Promise.resolve(buildOrder(order));
        },
      ),
      findUnique: jest.fn().mockImplementation((args: { where: { id: string } }) => {
        const order = orders.find((item) => item.id === args.where.id) ?? null;

        return Promise.resolve(order ? buildOrder(order) : null);
      }),
      findMany: jest.fn().mockImplementation((args: { where: { userId: string }; skip?: number; take?: number }) =>
        Promise.resolve(
          orders
            .filter((order) => order.userId === args.where.userId)
            .slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? orders.length))
            .map(buildOrder),
        ),
      ),
      update: jest.fn().mockImplementation(
        (args: {
          where: { id: string };
          data: { status: OrderStatus; paymentStatus: PaymentStatus };
        }) => {
          const order = orders.find((item) => item.id === args.where.id);

          if (!order) {
            throw new Error("Order not found");
          }

          Object.assign(order, args.data, { updatedAt: now });
          return Promise.resolve(buildOrder(order));
        },
      ),
    },
    payment: {
      findUnique: jest.fn().mockImplementation((args: { where: { idempotencyKey: string } }) =>
        Promise.resolve(
          payments.find((payment) => payment.idempotencyKey === args.where.idempotencyKey) ?? null,
        ),
      ),
      create: jest.fn().mockImplementation((args: { data: Omit<PaymentRecord, "id" | "createdAt" | "updatedAt"> }) => {
        const payment: PaymentRecord = {
          ...args.data,
          id: `payment-${String(payments.length + 1)}`,
          createdAt: now,
          updatedAt: now,
        };
        payments.push(payment);
        return Promise.resolve(payment);
      }),
      update: jest.fn().mockImplementation(
        (args: { where: { id: string }; data: { status: PaymentStatus } }) => {
          const payment = payments.find((item) => item.id === args.where.id);

          if (!payment) {
            throw new Error("Payment not found");
          }

          payment.status = args.data.status;
          payment.updatedAt = now;
          return Promise.resolve(payment);
        },
      ),
    },
  };

  return {
    cartItems,
    orders,
    payments,
    products,
    prisma,
    users,
  };
}

describe("Orders endpoints", () => {
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

  function createOrderPayload(bonusToSpend = 0) {
    return {
      name: "Demo User",
      phone: "+79990000000",
      city: "Moscow",
      street: "Tverskaya",
      house: "1",
      apartment: "2",
      postalCode: "101000",
      deliveryMethod: DeliveryMethod.COURIER,
      bonusToSpend,
    };
  }

  async function createOrder() {
    const csrfCookie = await getCsrfCookie();
    const csrfToken = getCookieValue(csrfCookie);

    return request(server)
      .post("/api/v1/orders")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", [csrfCookie, createAccessCookie("user-1")])
      .send(createOrderPayload(10_000))
      .expect(201);
  }

  it("creates order from user cart and snapshots product data", async () => {
    const response = await createOrder();

    expect(response.body).toMatchObject({
      status: OrderStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
      subtotalCents: 200_000,
      bonusSpentCents: 10_000,
      totalCents: 190_000,
      items: [
        {
          productId: "product-1",
          productName: "Demo Phone",
          productSlug: "demo-phone",
          productImage: "https://example.com/phone.jpg",
          quantity: 2,
          totalCents: 200_000,
        },
      ],
    });
    expect(store.products[0]?.stock).toBe(3);
    expect(store.users[0]?.bonusBalanceCents).toBe(40_000);
  });

  it("requires authenticated user", async () => {
    const csrfCookie = await getCsrfCookie();
    const csrfToken = getCookieValue(csrfCookie);

    await request(server)
      .post("/api/v1/orders")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", csrfCookie)
      .send(createOrderPayload())
      .expect(401);

    await request(server).get("/api/v1/orders").expect(401);
  });

  it("pays order idempotently, clears cart and accrues test bonuses", async () => {
    const orderResponse = await createOrder();
    const orderId = (orderResponse.body as { id: string }).id;
    const csrfCookie = await getCsrfCookie();
    const csrfToken = getCookieValue(csrfCookie);
    const cookies = [csrfCookie, createAccessCookie("user-1")];

    await request(server)
      .post(`/api/v1/orders/${orderId}/pay/mock`)
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", cookies)
      .send({ idempotencyKey: "payment-key-1" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: OrderStatus.PAID,
          paymentStatus: PaymentStatus.SUCCEEDED,
        });
      });

    await request(server)
      .post(`/api/v1/orders/${orderId}/pay/mock`)
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", cookies)
      .send({ idempotencyKey: "payment-key-1" })
      .expect(200);

    expect(store.cartItems).toEqual([]);
    expect(store.payments).toHaveLength(1);
    expect(store.users[0]?.bonusBalanceCents).toBe(49_500);
  });

  it("does not expose another user's order", async () => {
    const orderResponse = await createOrder();
    const orderId = (orderResponse.body as { id: string }).id;

    await request(server)
      .get(`/api/v1/orders/${orderId}`)
      .set("Cookie", createAccessCookie("user-2"))
      .expect(404);
  });
});
