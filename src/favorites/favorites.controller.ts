import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Request } from "express";

import { ACCESS_TOKEN_COOKIE } from "../common/cookies";
import { FavoriteDto, FavoritesListDto } from "./dto/favorites-response.dto";
import { FavoritesService } from "./favorites.service";

function readCookies(request: Request) {
  return request.cookies as Record<string, string | undefined> | undefined;
}

@ApiTags("favorites")
@Controller("favorites")
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOkResponse({ type: FavoritesListDto })
  listFavorites(@Req() request: Request) {
    return this.favoritesService.listFavorites(readCookies(request)?.[ACCESS_TOKEN_COOKIE]);
  }

  @Post(":productId")
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: FavoriteDto })
  addFavorite(@Req() request: Request, @Param("productId") productId: string) {
    return this.favoritesService.addFavorite(
      readCookies(request)?.[ACCESS_TOKEN_COOKIE],
      productId,
    );
  }

  @Delete(":productId")
  @ApiOkResponse({ schema: { properties: { ok: { type: "boolean" } } } })
  removeFavorite(@Req() request: Request, @Param("productId") productId: string) {
    return this.favoritesService.removeFavorite(
      readCookies(request)?.[ACCESS_TOKEN_COOKIE],
      productId,
    );
  }
}
