import jwt from "jsonwebtoken";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { User, UserRole } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

const accessTokenSecret = "test-access-token-secret";
const now = new Date("2026-01-01T00:00:00.000Z");

const user: User = {
  id: "user-1",
  email: "demo@example.com",
  passwordHash: "hash",
  name: "Demo User",
  avatarUrl: null,
  bonusBalanceCents: 15_000,
  role: UserRole.USER,
  createdAt: now,
  updatedAt: now,
};

function createAccessToken(userId = user.id) {
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

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue({
        ...user,
        avatarUrl: "https://example.com/avatar.png",
        name: "Updated User",
      }),
    },
  };
}

describe("UsersService", () => {
  it("returns public user profile for a valid access token", async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as unknown as PrismaService, createConfigService());

    await expect(service.getMe(createAccessToken())).resolves.toEqual({
      user: {
        id: "user-1",
        email: "demo@example.com",
        name: "Demo User",
        avatarUrl: null,
        bonusBalanceCents: 15_000,
        role: UserRole.USER,
      },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
  });

  it("updates only provided profile fields", async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as unknown as PrismaService, createConfigService());

    await service.updateMe(createAccessToken(), {
      name: "Updated User",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        name: "Updated User",
      },
    });
  });

  it("rejects when the token user no longer exists", async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const service = new UsersService(prisma as unknown as PrismaService, createConfigService());

    await expect(service.getMe(createAccessToken())).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
