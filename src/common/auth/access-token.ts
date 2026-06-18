import jwt from "jsonwebtoken";
import { UnauthorizedException } from "@nestjs/common";

import { AuthTokenPayload } from "../../auth/auth.types";

export function resolveAccessTokenUserId(accessToken: string | undefined, secret: string) {
  if (!accessToken) {
    throw new UnauthorizedException("Access token is missing");
  }

  try {
    const payload = jwt.verify(accessToken, secret) as AuthTokenPayload;

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
