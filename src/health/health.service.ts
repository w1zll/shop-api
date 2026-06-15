import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

export interface HealthResponse {
  status: "ok";
  service: "shop-api";
  timestamp: string;
}

export interface DatabaseHealthResponse {
  status: "ok";
  database: "postgresql";
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prismaService: PrismaService) {}

  getHealth(): HealthResponse {
    return {
      status: "ok",
      service: "shop-api",
      timestamp: new Date().toISOString(),
    };
  }

  async getDatabaseHealth(): Promise<DatabaseHealthResponse> {
    try {
      await this.prismaService.$queryRaw`SELECT 1`;

      return {
        status: "ok",
        database: "postgresql",
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException("Database is unavailable");
    }
  }
}
