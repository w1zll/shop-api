import { ConfigService } from "@nestjs/config";
import { NextFunction, Request } from "express";

import { CSRF_TOKEN_COOKIE } from "../cookies";
import { CsrfMiddleware } from "./csrf.middleware";

type ConfigValue = string | string[] | number | undefined;

function createConfigService(values: Record<string, ConfigValue>) {
  return {
    get<T>(key: string, defaultValue?: T) {
      return (values[key] ?? defaultValue) as T;
    },
  } as ConfigService;
}

function createRequest(origin: string | undefined, csrfToken = "csrf-token") {
  const headers = new Map<string, string>();

  if (origin) {
    headers.set("origin", origin);
  }

  headers.set("x-csrf-token", csrfToken);

  return {
    cookies: {
      [CSRF_TOKEN_COOKIE]: csrfToken,
    },
    header(name: string) {
      return headers.get(name.toLowerCase());
    },
    method: "POST",
  } as unknown as Request;
}

describe("CsrfMiddleware", () => {
  it("allows unsafe requests from additional frontend origins", () => {
    const middleware = new CsrfMiddleware(
      createConfigService({
        FRONTEND_ORIGIN: "https://shop.example.com",
        FRONTEND_ORIGINS:
          "https://shop-catalog-git-dev.example.com, https://shop-mf-cart.example.com/",
        NODE_ENV: "production",
      }),
    );
    const next = jest.fn();

    middleware.use(
      createRequest("https://shop-catalog-git-dev.example.com"),
      {} as never,
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledWith();
  });

  it("allows unsafe requests from the primary frontend origin", () => {
    const middleware = new CsrfMiddleware(
      createConfigService({
        FRONTEND_ORIGIN: "https://shop.example.com",
        FRONTEND_ORIGINS: [],
        NODE_ENV: "production",
      }),
    );
    const next = jest.fn();

    middleware.use(createRequest("https://shop.example.com"), {} as never, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects unsafe requests from unknown origins", () => {
    const middleware = new CsrfMiddleware(
      createConfigService({
        FRONTEND_ORIGIN: "https://shop.example.com",
        FRONTEND_ORIGINS: ["https://shop-catalog-git-dev.example.com"],
        NODE_ENV: "production",
      }),
    );
    const next = jest.fn();

    middleware.use(createRequest("https://evil.example.com"), {} as never, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Invalid request origin",
      }),
    );
  });
});
