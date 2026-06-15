import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { CatalogModule } from "./catalog/catalog.module";
import { validateEnvironment } from "./config/environment";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
    CatalogModule,
  ],
})
export class AppModule {}
