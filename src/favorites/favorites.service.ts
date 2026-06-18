import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";

import { resolveAccessTokenUserId } from "../common/auth/access-token";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_ACCESS_TOKEN_SECRET = "change-me-access-token-secret";

const favoriteInclude = {
  product: {
    include: {
      images: {
        orderBy: {
          position: "asc",
        },
        take: 1,
      },
    },
  },
} satisfies Prisma.FavoriteInclude;

type FavoriteWithProduct = Prisma.FavoriteGetPayload<{
  include: typeof favoriteInclude;
}>;

@Injectable()
export class FavoritesService {
  private readonly accessTokenSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenSecret =
      this.configService.get<string>("ACCESS_TOKEN_SECRET") ?? DEFAULT_ACCESS_TOKEN_SECRET;
  }

  async listFavorites(accessToken: string | undefined) {
    const userId = resolveAccessTokenUserId(accessToken, this.accessTokenSecret);
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      include: favoriteInclude,
      orderBy: { createdAt: "desc" },
    });

    return {
      items: favorites.map((favorite) => this.mapFavorite(favorite)),
    };
  }

  async addFavorite(accessToken: string | undefined, productId: string) {
    const userId = resolveAccessTokenUserId(accessToken, this.accessTokenSecret);
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true },
    });

    if (!product?.isActive) {
      throw new NotFoundException("Product not found");
    }

    try {
      const favorite = await this.prisma.favorite.create({
        data: {
          productId,
          userId,
        },
        include: favoriteInclude,
      });

      return this.mapFavorite(favorite);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Product is already in favorites");
      }

      throw error;
    }
  }

  async removeFavorite(accessToken: string | undefined, productId: string) {
    const userId = resolveAccessTokenUserId(accessToken, this.accessTokenSecret);
    const result = await this.prisma.favorite.deleteMany({
      where: {
        productId,
        userId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException("Favorite not found");
    }

    return { ok: true };
  }

  private mapFavorite(favorite: FavoriteWithProduct) {
    return {
      id: favorite.id,
      productId: favorite.productId,
      createdAt: favorite.createdAt.toISOString(),
      product: {
        id: favorite.product.id,
        name: favorite.product.name,
        slug: favorite.product.slug,
        brand: favorite.product.brand,
        priceCents: favorite.product.priceCents,
        oldPriceCents: favorite.product.oldPriceCents,
        stock: favorite.product.stock,
        imageUrl: favorite.product.images[0]?.url ?? null,
      },
    };
  }
}
