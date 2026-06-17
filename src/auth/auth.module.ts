import { Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CartModule } from "../cart/cart.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule, CartModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
