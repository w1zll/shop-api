import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { DEFAULT_DATABASE_URL } from "../config/environment";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(configService: ConfigService) {
    const databaseUrl = configService.get<string>("DATABASE_URL") ?? DEFAULT_DATABASE_URL;
    super({
      adapter: new PrismaPg(databaseUrl),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
