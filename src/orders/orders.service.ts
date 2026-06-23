import { randomUUID } from "node:crypto";

import jwt from "jsonwebtoken";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";

import { AuthTokenPayload } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import { CreateOrderDto, MockPaymentDto } from "./dto/order-request.dto";

const DEFAULT_ACCESS_TOKEN_SECRET = "change-me-access-token-secret";
const TEST_BONUS_RATE = 0.05;

const orderInclude = {
  items: {
    orderBy: {
      id: "asc",
    },
  },
} satisfies Prisma.OrderInclude;

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

type OrderWithItems = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

@Injectable()
export class OrdersService {
  private readonly accessTokenSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenSecret =
      this.configService.get<string>("ACCESS_TOKEN_SECRET") ?? DEFAULT_ACCESS_TOKEN_SECRET;
  }

  async createOrder(accessToken: string | undefined, dto: CreateOrderDto) {
    const userId = this.resolveUserId(accessToken);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          bonusBalanceCents: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      const cart = await tx.cart.findUnique({
        where: { userId },
        include: cartInclude,
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException("Cart is empty");
      }

      const activeItems = cart.items.filter((item) => item.product.isActive);

      if (activeItems.length === 0) {
        throw new BadRequestException("Cart is empty");
      }

      const subtotalCents = activeItems.reduce(
        (sum, item) => sum + item.quantity * item.product.priceCents,
        0,
      );
      const bonusSpentCents = dto.bonusToSpend ?? 0;

      if (bonusSpentCents > user.bonusBalanceCents) {
        throw new BadRequestException("Not enough bonus balance");
      }

      if (bonusSpentCents > subtotalCents) {
        throw new BadRequestException("Bonus amount exceeds order subtotal");
      }

      for (const item of activeItems) {
        const updateResult = await tx.product.updateMany({
          where: {
            id: item.productId,
            isActive: true,
            stock: {
              gte: item.quantity,
            },
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        if (updateResult.count !== 1) {
          throw new BadRequestException("Product stock is not enough");
        }
      }

      if (bonusSpentCents > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            bonusBalanceCents: {
              decrement: bonusSpentCents,
            },
          },
        });
      }

      const order = await tx.order.create({
        data: {
          number: this.createOrderNumber(),
          userId,
          status: OrderStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.PENDING,
          subtotalCents,
          bonusSpentCents,
          deliveryCents: 0,
          discountCents: 0,
          totalCents: subtotalCents - bonusSpentCents,
          deliveryMethod: dto.deliveryMethod,
          deliveryAddress: {
            apartment: dto.apartment ?? null,
            city: dto.city,
            house: dto.house,
            name: dto.name,
            phone: dto.phone,
            postalCode: dto.postalCode,
            street: dto.street,
          },
          items: {
            create: activeItems.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              productSlug: item.product.slug,
              productImage: item.product.images[0]?.url ?? null,
              unitPriceCents: item.product.priceCents,
              quantity: item.quantity,
              totalCents: item.quantity * item.product.priceCents,
            })),
          },
        },
        include: orderInclude,
      });

      return this.mapOrder(order);
    });
  }

  async payMock(accessToken: string | undefined, orderId: string, dto: MockPaymentDto) {
    const userId = this.resolveUserId(accessToken);

    return this.prisma.$transaction(async (tx) => {
      const existingPayment = await tx.payment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });

      if (existingPayment && existingPayment.orderId !== orderId) {
        throw new ConflictException("Idempotency key is already used");
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });

      if (!order || order.userId !== userId) {
        throw new NotFoundException("Order not found");
      }

      if (existingPayment?.status === PaymentStatus.SUCCEEDED) {
        return this.mapOrder(order);
      }

      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new BadRequestException("Order cannot be paid");
      }

      const payment =
        existingPayment ??
        (await tx.payment.create({
          data: {
            orderId: order.id,
            userId,
            amountCents: order.totalCents,
            idempotencyKey: dto.idempotencyKey,
            status: PaymentStatus.PENDING,
          },
        }));

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCEEDED },
      });

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          paymentStatus: PaymentStatus.SUCCEEDED,
        },
        include: orderInclude,
      });

      const cart = await tx.cart.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (cart) {
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });
      }

      const earnedBonusCents = Math.floor(updatedOrder.totalCents * TEST_BONUS_RATE);

      if (earnedBonusCents > 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            bonusBalanceCents: {
              increment: earnedBonusCents,
            },
          },
        });
      }

      return this.mapOrder(updatedOrder);
    });
  }

  async listOrders(accessToken: string | undefined, query: ListOrdersQueryDto = new ListOrdersQueryDto()) {
    const userId = this.resolveUserId(accessToken);
    const page = query.page;
    const limit = query.limit;
    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where: { userId } }),
      this.prisma.order.findMany({
        where: { userId },
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: orders.map((order) => this.mapOrder(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrder(accessToken: string | undefined, orderId: string) {
    const userId = this.resolveUserId(accessToken);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException("Order not found");
    }

    return this.mapOrder(order);
  }

  private resolveUserId(accessToken: string | undefined) {
    if (!accessToken) {
      throw new UnauthorizedException("Access token is missing");
    }

    try {
      const payload = jwt.verify(accessToken, this.accessTokenSecret) as AuthTokenPayload;

      if (payload.type !== "access") {
        throw new UnauthorizedException("Invalid access token");
      }

      return payload.sub;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Invalid access token");
    }
  }

  private createOrderNumber() {
    return `ORD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private mapOrder(order: OrderWithItems) {
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      bonusSpentCents: order.bonusSpentCents,
      earnedBonusCents:
        order.paymentStatus === PaymentStatus.SUCCEEDED
          ? Math.floor(order.totalCents * TEST_BONUS_RATE)
          : 0,
      deliveryCents: order.deliveryCents,
      totalCents: order.totalCents,
      deliveryMethod: order.deliveryMethod,
      deliveryAddress: order.deliveryAddress,
      items: order.items,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
