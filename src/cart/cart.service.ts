import { randomUUID } from "node:crypto";

import jwt from "jsonwebtoken";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { Prisma } from "@prisma/client";

import { ACCESS_TOKEN_COOKIE, ANONYMOUS_CART_COOKIE } from "../common/cookies";
import { AuthTokenPayload } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { AddCartItemDto, UpdateCartItemDto } from "./dto/cart-request.dto";

const DEFAULT_ACCESS_TOKEN_SECRET = "change-me-access-token-secret";
const ANONYMOUS_CART_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const cartInclude = {
  items: {
    include: {
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
    },
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{
  include: typeof cartInclude;
}>;

type TransactionClient = Prisma.TransactionClient;

export interface CartRequestContext {
  accessToken?: string;
  anonymousId?: string;
}

@Injectable()
export class CartService {
  private readonly accessTokenSecret: string;
  private readonly secureCookies: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenSecret =
      this.configService.get<string>("ACCESS_TOKEN_SECRET") ?? DEFAULT_ACCESS_TOKEN_SECRET;
    this.secureCookies = this.configService.get<string>("NODE_ENV") === "production";
  }

  async getCart(context: CartRequestContext, response: Response) {
    const cart = await this.resolveCart(context, response);

    return this.mapCart(cart);
  }

  async getSummary(context: CartRequestContext, response: Response) {
    const cart = await this.resolveCart(context, response);

    return this.buildSummary(cart);
  }

  async addItem(context: CartRequestContext, response: Response, dto: AddCartItemDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: dto.productId },
        select: {
          id: true,
          isActive: true,
          stock: true,
        },
      });

      if (!product || !product.isActive) {
        throw new NotFoundException("Product not found");
      }

      const cart = await this.resolveCart(context, response, tx);
      const existingItem = cart.items.find((item) => item.productId === product.id);
      const nextQuantity = (existingItem?.quantity ?? 0) + dto.quantity;

      this.assertQuantityAvailable(nextQuantity, product.stock);

      if (existingItem) {
        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: nextQuantity },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId: product.id,
            quantity: dto.quantity,
          },
        });
      }

      return this.mapCart(await this.getCartById(cart.id, tx));
    });
  }

  async updateItem(
    context: CartRequestContext,
    response: Response,
    itemId: string,
    dto: UpdateCartItemDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await this.resolveCart(context, response, tx);
      const item = cart.items.find((cartItem) => cartItem.id === itemId);

      if (!item) {
        throw new NotFoundException("Cart item not found");
      }

      this.assertQuantityAvailable(dto.quantity, item.product.stock);

      await tx.cartItem.update({
        where: { id: item.id },
        data: { quantity: dto.quantity },
      });

      return this.mapCart(await this.getCartById(cart.id, tx));
    });
  }

  async removeItem(context: CartRequestContext, response: Response, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await this.resolveCart(context, response, tx);
      const item = cart.items.find((cartItem) => cartItem.id === itemId);

      if (!item) {
        throw new NotFoundException("Cart item not found");
      }

      await tx.cartItem.delete({
        where: { id: item.id },
      });

      return this.mapCart(await this.getCartById(cart.id, tx));
    });
  }

  async clearCart(context: CartRequestContext, response: Response) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await this.resolveCart(context, response, tx);

      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return this.mapCart(await this.getCartById(cart.id, tx));
    });
  }

  async mergeAnonymousCartIntoUserCart(
    userId: string,
    anonymousId: string | undefined,
    response: Response,
  ) {
    if (!anonymousId) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.mergeAnonymousCart(userId, anonymousId, tx);
    });
    this.clearAnonymousCartCookie(response);
  }

  private async resolveCart(
    context: CartRequestContext,
    response: Response,
    tx: TransactionClient | PrismaService = this.prisma,
  ) {
    const userId = this.resolveUserId(context.accessToken, response);

    if (userId) {
      if (context.anonymousId) {
        await this.mergeAnonymousCart(userId, context.anonymousId, tx);
        this.clearAnonymousCartCookie(response);
      }

      const userCart = await tx.cart.upsert({
        where: { userId },
        create: { userId },
        update: {},
        include: cartInclude,
      });

      return userCart;
    }

    const anonymousId = context.anonymousId ?? randomUUID();
    const anonymousCart = await tx.cart.upsert({
      where: { anonymousId },
      create: { anonymousId },
      update: {},
      include: cartInclude,
    });

    if (!context.anonymousId) {
      this.setAnonymousCartCookie(response, anonymousId);
    }

    return anonymousCart;
  }

  private async mergeAnonymousCart(
    userId: string,
    anonymousId: string,
    tx: TransactionClient | PrismaService,
  ) {
    const anonymousCart = await tx.cart.findUnique({
      where: { anonymousId },
      include: {
        items: true,
      },
    });

    if (!anonymousCart) {
      return;
    }

    const userCart = await tx.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: {
        items: true,
      },
    });

    for (const anonymousItem of anonymousCart.items) {
      const product = await tx.product.findUnique({
        where: { id: anonymousItem.productId },
        select: {
          isActive: true,
          stock: true,
        },
      });

      if (!product?.isActive) {
        continue;
      }

      const userItem = userCart.items.find((item) => item.productId === anonymousItem.productId);
      const quantity = Math.min((userItem?.quantity ?? 0) + anonymousItem.quantity, product.stock);

      if (quantity < 1) {
        continue;
      }

      if (userItem) {
        await tx.cartItem.update({
          where: { id: userItem.id },
          data: { quantity },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: userCart.id,
            productId: anonymousItem.productId,
            quantity,
          },
        });
      }
    }

    await tx.cart.delete({
      where: { id: anonymousCart.id },
    });
  }

  private async getCartById(id: string, tx: TransactionClient | PrismaService) {
    const cart = await tx.cart.findUnique({
      where: { id },
      include: cartInclude,
    });

    if (!cart) {
      throw new NotFoundException("Cart not found");
    }

    return cart;
  }

  private resolveUserId(accessToken: string | undefined, response: Response) {
    if (!accessToken) {
      return undefined;
    }

    try {
      const payload = jwt.verify(accessToken, this.accessTokenSecret) as AuthTokenPayload;

      if (payload.type !== "access") {
        this.clearAccessTokenCookie(response);
        return undefined;
      }

      return payload.sub;
    } catch {
      this.clearAccessTokenCookie(response);
      return undefined;
    }
  }

  private assertQuantityAvailable(quantity: number, stock: number) {
    if (stock < 1) {
      throw new BadRequestException("Product is out of stock");
    }

    if (quantity > stock) {
      throw new BadRequestException("Quantity exceeds product stock");
    }
  }

  private mapCart(cart: CartWithItems) {
    const items = cart.items
      .filter((item) => item.product.isActive)
      .map((item) => {
        const imageUrl = item.product.images.length > 0 ? item.product.images[0].url : null;

        return {
          id: item.id,
          productId: item.productId,
          quantity: Math.min(item.quantity, item.product.stock),
          unitPriceCents: item.product.priceCents,
          totalCents: Math.min(item.quantity, item.product.stock) * item.product.priceCents,
          product: {
            id: item.product.id,
            name: item.product.name,
            slug: item.product.slug,
            brand: item.product.brand,
            priceCents: item.product.priceCents,
            oldPriceCents: item.product.oldPriceCents,
            stock: item.product.stock,
            imageUrl,
          },
        };
      });
    const summary = {
      itemsCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotalCents: items.reduce((sum, item) => sum + item.totalCents, 0),
    };

    return {
      id: cart.id,
      isAnonymous: !cart.userId,
      items,
      summary,
    };
  }

  private buildSummary(cart: CartWithItems) {
    return this.mapCart(cart).summary;
  }

  private setAnonymousCartCookie(response: Response, anonymousId: string) {
    response.cookie(ANONYMOUS_CART_COOKIE, anonymousId, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.secureCookies,
      path: "/",
      maxAge: ANONYMOUS_CART_MAX_AGE_MS,
    });
  }

  private clearAnonymousCartCookie(response: Response) {
    response.clearCookie(ANONYMOUS_CART_COOKIE, {
      path: "/",
    });
  }

  private clearAccessTokenCookie(response: Response) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, {
      path: "/",
    });
  }
}

export function getCartRequestContext(cookies: Record<string, string | undefined> | undefined) {
  return {
    accessToken: cookies?.[ACCESS_TOKEN_COOKIE],
    anonymousId: cookies?.[ANONYMOUS_CART_COOKIE],
  };
}
