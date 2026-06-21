import jwt from "jsonwebtoken";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeliveryMethod, OrderStatus, PaymentStatus, UserRole } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "./orders.service";

const accessTokenSecret = "test-access-token-secret";
const now = new Date("2026-01-01T00:00:00.000Z");

type CreatedOrderItem = {
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string | null;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
};

type CreatedOrderData = {
  number: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotalCents: number;
  bonusSpentCents: number;
  deliveryCents: number;
  discountCents: number;
  totalCents: number;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: unknown;
  items: {
    create: CreatedOrderItem[];
  };
};

function createAccessToken(userId = "user-1") {
  return jwt.sign(
    {
      role: UserRole.USER,
      sub: userId,
      type: "access",
    },
    accessTokenSecret,
    { expiresIn: "15m" },
  );
}

function createConfigService() {
  return {
    get: jest.fn((key: string) => (key === "ACCESS_TOKEN_SECRET" ? accessTokenSecret : undefined)),
  } as unknown as ConfigService;
}

function createOrderPayload(bonusToSpend = 0) {
  return {
    apartment: "2",
    bonusToSpend,
    city: "Moscow",
    deliveryMethod: DeliveryMethod.COURIER,
    house: "1",
    name: "Demo User",
    phone: "+79990000000",
    postalCode: "101000",
    street: "Tverskaya",
  };
}

function createPrismaMock() {
  const product = {
    id: "product-1",
    name: "Demo Phone",
    slug: "demo-phone",
    priceCents: 100_000,
    stock: 5,
    isActive: true,
    images: [{ url: "https://example.com/phone.jpg" }],
  };
  const prisma = {
    $transaction: jest
      .fn()
      .mockImplementation((callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)),
    cart: {
      findUnique: jest.fn().mockResolvedValue({
        id: "cart-1",
        userId: "user-1",
        anonymousId: null,
        createdAt: now,
        updatedAt: now,
        items: [
          {
            id: "cart-item-1",
            cartId: "cart-1",
            productId: product.id,
            quantity: 2,
            createdAt: now,
            updatedAt: now,
            product,
          },
        ],
      }),
    },
    cartItem: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    order: {
      create: jest.fn().mockImplementation((args: { data: CreatedOrderData }) =>
        Promise.resolve({
          id: "order-1",
          ...args.data,
          createdAt: now,
          updatedAt: now,
          items: args.data.items.create.map((item, index) => ({
            id: `order-item-${String(index + 1)}`,
            orderId: "order-1",
            ...item,
          })),
        }),
      ),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    product: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: "user-1",
        bonusBalanceCents: 50_000,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  return prisma;
}

describe("OrdersService", () => {
  it("creates order from active cart items and snapshots product data", async () => {
    const prisma = createPrismaMock();
    const service = new OrdersService(prisma as unknown as PrismaService, createConfigService());

    await expect(
      service.createOrder(createAccessToken(), createOrderPayload(10_000)),
    ).resolves.toMatchObject({
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
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: "product-1",
        isActive: true,
        stock: {
          gte: 2,
        },
      },
      data: {
        stock: {
          decrement: 2,
        },
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        bonusBalanceCents: {
          decrement: 10_000,
        },
      },
    });
  });

  it("rejects orders when bonus spend exceeds user balance", async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      bonusBalanceCents: 1_000,
    });
    const service = new OrdersService(prisma as unknown as PrismaService, createConfigService());

    await expect(
      service.createOrder(createAccessToken(), createOrderPayload(10_000)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it("rejects reused payment idempotency keys from another order", async () => {
    const prisma = createPrismaMock();
    prisma.payment.findUnique.mockResolvedValue({
      id: "payment-1",
      orderId: "another-order",
    });
    const service = new OrdersService(prisma as unknown as PrismaService, createConfigService());

    await expect(
      service.payMock(createAccessToken(), "order-1", {
        idempotencyKey: "payment-key-1",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });
});
