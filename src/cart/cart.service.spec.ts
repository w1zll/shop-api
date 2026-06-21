import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";

import { ACCESS_TOKEN_COOKIE, ANONYMOUS_CART_COOKIE } from "../common/cookies";
import { PrismaService } from "../prisma/prisma.service";
import { CartService, getCartRequestContext } from "./cart.service";

const now = new Date("2026-01-01T00:00:00.000Z");

const activeProduct = {
  id: "product-1",
  name: "Demo Phone",
  slug: "demo-phone",
  brand: "Demo",
  priceCents: 100_000,
  oldPriceCents: null,
  stock: 2,
  isActive: true,
  images: [
    {
      url: "https://example.com/phone.jpg",
    },
  ],
};

function createConfigService() {
  return {
    get: jest.fn(),
  } as unknown as ConfigService;
}

function createResponseMock() {
  return {
    clearCookie: jest.fn(),
    cookie: jest.fn(),
  } as unknown as Response;
}

function createCart(
  items = [{ id: "item-1", productId: activeProduct.id, quantity: 1, product: activeProduct }],
) {
  return {
    id: "cart-1",
    userId: null,
    anonymousId: "anonymous-1",
    createdAt: now,
    updatedAt: now,
    items,
  };
}

function createPrismaMock() {
  const prisma = {
    $transaction: jest
      .fn()
      .mockImplementation((callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)),
    cart: {
      upsert: jest.fn().mockResolvedValue(createCart()),
    },
    cartItem: {
      create: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findUnique: jest.fn().mockResolvedValue({
        id: activeProduct.id,
        isActive: true,
        stock: activeProduct.stock,
      }),
    },
  };

  return prisma;
}

describe("getCartRequestContext", () => {
  it("reads auth and anonymous cart cookies", () => {
    expect(
      getCartRequestContext({
        [ACCESS_TOKEN_COOKIE]: "access-token",
        [ANONYMOUS_CART_COOKIE]: "anonymous-1",
      }),
    ).toEqual({
      accessToken: "access-token",
      anonymousId: "anonymous-1",
    });
  });
});

describe("CartService", () => {
  it("builds summary from active products and caps quantity by current stock", async () => {
    const prisma = createPrismaMock();
    prisma.cart.upsert.mockResolvedValue(
      createCart([
        {
          id: "item-1",
          productId: "product-1",
          quantity: 5,
          product: activeProduct,
        },
        {
          id: "item-2",
          productId: "inactive-product",
          quantity: 1,
          product: {
            ...activeProduct,
            id: "inactive-product",
            isActive: false,
          },
        },
      ]),
    );
    const service = new CartService(prisma as unknown as PrismaService, createConfigService());

    await expect(
      service.getSummary({ anonymousId: "anonymous-1" }, createResponseMock()),
    ).resolves.toEqual({
      itemsCount: 1,
      totalQuantity: 2,
      subtotalCents: 200_000,
    });
  });

  it("rejects missing or inactive products before cart mutation", async () => {
    const prisma = createPrismaMock();
    prisma.product.findUnique.mockResolvedValue(null);
    const service = new CartService(prisma as unknown as PrismaService, createConfigService());

    await expect(
      service.addItem({ anonymousId: "anonymous-1" }, createResponseMock(), {
        productId: "missing-product",
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
    expect(prisma.cartItem.update).not.toHaveBeenCalled();
  });

  it("rejects quantity above product stock", async () => {
    const prisma = createPrismaMock();
    const service = new CartService(prisma as unknown as PrismaService, createConfigService());

    await expect(
      service.addItem({ anonymousId: "anonymous-1" }, createResponseMock(), {
        productId: "product-1",
        quantity: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
    expect(prisma.cartItem.update).not.toHaveBeenCalled();
  });
});
