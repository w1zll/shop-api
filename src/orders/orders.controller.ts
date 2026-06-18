import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Request } from "express";

import { ACCESS_TOKEN_COOKIE } from "../common/cookies";
import { CreateOrderDto, MockPaymentDto } from "./dto/order-request.dto";
import { OrderDto, OrdersListDto } from "./dto/order-response.dto";
import { OrdersService } from "./orders.service";

function readCookies(request: Request) {
  return request.cookies as Record<string, string | undefined> | undefined;
}

@ApiTags("orders")
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: OrderDto })
  createOrder(@Req() request: Request, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(readCookies(request)?.[ACCESS_TOKEN_COOKIE], dto);
  }

  @Post(":id/pay/mock")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: OrderDto })
  payMock(@Req() request: Request, @Param("id") orderId: string, @Body() dto: MockPaymentDto) {
    return this.ordersService.payMock(
      readCookies(request)?.[ACCESS_TOKEN_COOKIE],
      orderId,
      dto,
    );
  }

  @Get()
  @ApiOkResponse({ type: OrdersListDto })
  listOrders(@Req() request: Request) {
    return this.ordersService.listOrders(readCookies(request)?.[ACCESS_TOKEN_COOKIE]);
  }

  @Get(":id")
  @ApiOkResponse({ type: OrderDto })
  getOrder(@Req() request: Request, @Param("id") orderId: string) {
    return this.ordersService.getOrder(readCookies(request)?.[ACCESS_TOKEN_COOKIE], orderId);
  }
}
