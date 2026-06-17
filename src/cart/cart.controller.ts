import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";

import { CartService, getCartRequestContext } from "./cart.service";
import { AddCartItemDto, UpdateCartItemDto } from "./dto/cart-request.dto";
import { CartDto, CartSummaryDto } from "./dto/cart-response.dto";

function readCookies(request: Request) {
  return request.cookies as Record<string, string | undefined> | undefined;
}

@ApiTags("cart")
@Controller("cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOkResponse({ type: CartDto })
  getCart(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.cartService.getCart(getCartRequestContext(readCookies(request)), response);
  }

  @Get("summary")
  @ApiOkResponse({ type: CartSummaryDto })
  getSummary(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.cartService.getSummary(getCartRequestContext(readCookies(request)), response);
  }

  @Post("items")
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: CartDto })
  addItem(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(getCartRequestContext(readCookies(request)), response, dto);
  }

  @Patch("items/:itemId")
  @ApiOkResponse({ type: CartDto })
  updateItem(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(
      getCartRequestContext(readCookies(request)),
      response,
      itemId,
      dto,
    );
  }

  @Delete("items/:itemId")
  @ApiOkResponse({ type: CartDto })
  removeItem(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Param("itemId") itemId: string,
  ) {
    return this.cartService.removeItem(getCartRequestContext(readCookies(request)), response, itemId);
  }

  @Delete()
  @ApiOkResponse({ type: CartDto })
  clearCart(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.cartService.clearCart(getCartRequestContext(readCookies(request)), response);
  }
}
