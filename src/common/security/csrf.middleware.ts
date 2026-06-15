import { ForbiddenException, Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NextFunction, Request, Response } from "express";

import { CSRF_TOKEN_COOKIE } from "../cookies";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookies(request: Request) {
  return request.cookies as Record<string, string | undefined> | undefined;
}

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(request: Request, _response: Response, next: NextFunction) {
    if (!unsafeMethods.has(request.method)) {
      next();
      return;
    }

    const expectedOrigin = this.configService.get<string>(
      "FRONTEND_ORIGIN",
      "http://localhost:3000",
    );
    const origin = request.header("origin");

    if (origin !== expectedOrigin) {
      next(new ForbiddenException("Invalid request origin"));
      return;
    }

    const csrfCookie = readCookies(request)?.[CSRF_TOKEN_COOKIE];
    const csrfHeader = request.header("x-csrf-token");

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      next(new ForbiddenException("Invalid CSRF token"));
      return;
    }

    next();
  }
}
