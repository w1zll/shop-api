import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { User } from "@prisma/client";

import { resolveAccessTokenUserId } from "../common/auth/access-token";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateProfileDto } from "./dto/user-request.dto";

const DEFAULT_ACCESS_TOKEN_SECRET = "change-me-access-token-secret";

function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bonusBalanceCents: user.bonusBalanceCents,
    role: user.role,
  };
}

@Injectable()
export class UsersService {
  private readonly accessTokenSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenSecret =
      this.configService.get<string>("ACCESS_TOKEN_SECRET") ?? DEFAULT_ACCESS_TOKEN_SECRET;
  }

  async getMe(accessToken: string | undefined) {
    const userId = resolveAccessTokenUserId(accessToken, this.accessTokenSecret);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return { user: toPublicUser(user) };
  }

  async updateMe(accessToken: string | undefined, dto: UpdateProfileDto) {
    const userId = resolveAccessTokenUserId(accessToken, this.accessTokenSecret);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });

    return { user: toPublicUser(user) };
  }
}
