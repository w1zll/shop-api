import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../common/cookies";
import { AuthService } from "./auth.service";
import { AuthResponseDto, CsrfResponseDto } from "./dto/auth-response.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

function readCookies(request: Request) {
  return request.cookies as Record<string, string | undefined> | undefined;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("csrf")
  @ApiOkResponse({ type: CsrfResponseDto })
  getCsrf(@Res({ passthrough: true }) response: Response) {
    return this.authService.createCsrfToken(response);
  }

  @Post("register")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    return this.authService.register(dto, response);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.authService.login(dto, response);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.refresh(readCookies(request)?.[REFRESH_TOKEN_COOKIE], response);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ schema: { properties: { ok: { type: "boolean" } } } })
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.logout(readCookies(request)?.[REFRESH_TOKEN_COOKIE], response);
  }

  @Get("me")
  @ApiOkResponse({ type: AuthResponseDto })
  getMe(@Req() request: Request) {
    return this.authService.getMe(readCookies(request)?.[ACCESS_TOKEN_COOKIE]);
  }
}
