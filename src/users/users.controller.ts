import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Request } from "express";

import { ACCESS_TOKEN_COOKIE } from "../common/cookies";
import { UpdateProfileDto } from "./dto/user-request.dto";
import { UserProfileResponseDto } from "./dto/user-response.dto";
import { UsersService } from "./users.service";

function readCookies(request: Request) {
  return request.cookies as Record<string, string | undefined> | undefined;
}

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOkResponse({ type: UserProfileResponseDto })
  getMe(@Req() request: Request) {
    return this.usersService.getMe(readCookies(request)?.[ACCESS_TOKEN_COOKIE]);
  }

  @Patch("me")
  @ApiOkResponse({ type: UserProfileResponseDto })
  updateMe(@Req() request: Request, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(readCookies(request)?.[ACCESS_TOKEN_COOKIE], dto);
  }
}
