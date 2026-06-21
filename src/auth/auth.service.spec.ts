import { ConfigService } from "@nestjs/config";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { Response } from "express";

import { CartService } from "../cart/cart.service";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../common/cookies";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

function createConfigService() {
  return {
    get: jest.fn(),
  } as unknown as ConfigService;
}

function createPrismaMock() {
  return {
    session: {
      updateMany: jest.fn(),
    },
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

function createCartServiceMock() {
  return {
    mergeAnonymousCartIntoUserCart: jest.fn(),
  } as unknown as CartService;
}

function createResponseMock() {
  const clearCookie = jest.fn();
  const cookie = jest.fn();

  return {
    clearCookie,
    cookie,
    response: {
      clearCookie,
      cookie,
    } as unknown as Response,
  };
}

describe("AuthService", () => {
  it("rejects registration when email is already registered", async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    const service = new AuthService(
      prisma as unknown as PrismaService,
      createConfigService(),
      createCartServiceMock(),
    );
    const { response } = createResponseMock();

    await expect(
      service.register(
        {
          email: "demo@example.com",
          name: "Demo User",
          password: "password123",
        },
        response,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects login for unknown users", async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const service = new AuthService(
      prisma as unknown as PrismaService,
      createConfigService(),
      createCartServiceMock(),
    );
    const { response } = createResponseMock();

    await expect(
      service.login(
        {
          email: "missing@example.com",
          password: "password123",
        },
        response,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects refresh without refresh token", async () => {
    const service = new AuthService(
      createPrismaMock() as unknown as PrismaService,
      createConfigService(),
      createCartServiceMock(),
    );
    const { response } = createResponseMock();

    await expect(service.refresh(undefined, response)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("clears auth cookies even when logout receives an invalid refresh token", async () => {
    const service = new AuthService(
      createPrismaMock() as unknown as PrismaService,
      createConfigService(),
      createCartServiceMock(),
    );
    const { clearCookie, response } = createResponseMock();

    await expect(service.logout("invalid-token", response)).resolves.toEqual({ ok: true });
    expect(clearCookie).toHaveBeenCalledWith(ACCESS_TOKEN_COOKIE, { path: "/" });
    expect(clearCookie).toHaveBeenCalledWith(REFRESH_TOKEN_COOKIE, { path: "/api/v1/auth" });
  });
});
