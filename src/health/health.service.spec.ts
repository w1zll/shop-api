import { ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("returns API health", () => {
    const service = new HealthService({} as PrismaService);

    expect(service.getHealth()).toMatchObject({
      status: "ok",
      service: "shop-api",
    });
  });

  it("returns database health when Prisma query succeeds", async () => {
    const service = new HealthService({
      $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as unknown as PrismaService);

    await expect(service.getDatabaseHealth()).resolves.toMatchObject({
      status: "ok",
      database: "postgresql",
    });
  });

  it("throws when database query fails", async () => {
    const service = new HealthService({
      $queryRaw: jest.fn().mockRejectedValue(new Error("connection failed")),
    } as unknown as PrismaService);

    await expect(service.getDatabaseHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
