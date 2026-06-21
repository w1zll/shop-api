import jwt from "jsonwebtoken";
import { UnauthorizedException } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { resolveAccessTokenUserId } from "./access-token";

const secret = "test-access-token-secret";

function createToken(type: "access" | "refresh" = "access") {
  return jwt.sign(
    {
      role: UserRole.USER,
      sub: "user-1",
      type,
    },
    secret,
    { expiresIn: "15m" },
  );
}

describe("resolveAccessTokenUserId", () => {
  it("returns user id from a valid access token", () => {
    expect(resolveAccessTokenUserId(createToken(), secret)).toBe("user-1");
  });

  it("rejects missing, malformed and non-access tokens", () => {
    expect(() => resolveAccessTokenUserId(undefined, secret)).toThrow(UnauthorizedException);
    expect(() => resolveAccessTokenUserId("not-a-token", secret)).toThrow(UnauthorizedException);
    expect(() => resolveAccessTokenUserId(createToken("refresh"), secret)).toThrow(
      UnauthorizedException,
    );
  });
});
