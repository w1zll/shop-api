import jwt from "jsonwebtoken";
import { ConfigService } from "@nestjs/config";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { FavoritesService } from "./favorites.service";

const accessTokenSecret = "test-access-token-secret";
const now = new Date("2026-01-01T00:00:00.000Z");

const product = {
  id: "product-1",
  name: "Demo Phone",
  slug: "demo-phone",
  brand: "Demo",
  priceCents: 100_000,
  oldPriceCents: null,
  stock: 5,
  images: [
    {
      url: "https://example.com/phone.jpg",
    },
  ],
};

function createAccessToken() {
  return jwt.sign(
    {
      role: UserRole.USER,
      sub: "user-1",
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

function createPrismaMock() {
  return {
    favorite: {
      create: jest.fn().mockResolvedValue({
        id: "favorite-1",
        productId: "product-1",
        userId: "user-1",
        createdAt: now,
        product,
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: "favorite-1",
          productId: "product-1",
          userId: "user-1",
          createdAt: now,
          product,
        },
      ]),
    },
    product: {
      findUnique: jest.fn().mockResolvedValue({
        id: "product-1",
        isActive: true,
      }),
    },
  };
}

describe("FavoritesService", () => {
  it("lists favorites and maps product image", async () => {
    const prisma = createPrismaMock();
    const service = new FavoritesService(prisma as unknown as PrismaService, createConfigService());

    await expect(service.listFavorites(createAccessToken())).resolves.toEqual({
      items: [
        {
          id: "favorite-1",
          productId: "product-1",
          createdAt: now.toISOString(),
          product: {
            id: "product-1",
            name: "Demo Phone",
            slug: "demo-phone",
            brand: "Demo",
            priceCents: 100_000,
            oldPriceCents: null,
            stock: 5,
            imageUrl: "https://example.com/phone.jpg",
          },
        },
      ],
    });
    expect(prisma.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
      }),
    );
  });

  it("rejects inactive or missing products", async () => {
    const prisma = createPrismaMock();
    prisma.product.findUnique.mockResolvedValue(null);
    const service = new FavoritesService(prisma as unknown as PrismaService, createConfigService());

    await expect(
      service.addFavorite(createAccessToken(), "missing-product"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.favorite.create).not.toHaveBeenCalled();
  });

  it("converts unique constraint errors to conflict response", async () => {
    const prisma = createPrismaMock();
    prisma.favorite.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        clientVersion: "test",
        code: "P2002",
      }),
    );
    const service = new FavoritesService(prisma as unknown as PrismaService, createConfigService());

    await expect(service.addFavorite(createAccessToken(), "product-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("returns ok on delete and rejects missing favorites", async () => {
    const prisma = createPrismaMock();
    const service = new FavoritesService(prisma as unknown as PrismaService, createConfigService());

    await expect(service.removeFavorite(createAccessToken(), "product-1")).resolves.toEqual({
      ok: true,
    });

    prisma.favorite.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.removeFavorite(createAccessToken(), "product-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
