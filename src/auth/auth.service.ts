import { randomBytes, randomUUID, createHash } from "node:crypto";

import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { User, UserRole } from "@prisma/client";

import { ACCESS_TOKEN_COOKIE, CSRF_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../common/cookies";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { PrismaService } from "../prisma/prisma.service";
import { AuthTokenPayload } from "./auth.types";

const PASSWORD_SALT_ROUNDS = 12;
const DEFAULT_ACCESS_TOKEN_SECRET = "change-me-access-token-secret";
const DEFAULT_REFRESH_TOKEN_SECRET = "change-me-refresh-token-secret";
const DEFAULT_ACCESS_TOKEN_TTL = "15m";
const DEFAULT_REFRESH_TOKEN_TTL = "30d";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseDurationMs(value: string) {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);

  if (!match) {
    throw new Error(`Unsupported duration format: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  if (unit === "s") {
    return amount * 1000;
  }

  if (unit === "m") {
    return amount * 60 * 1000;
  }

  if (unit === "h") {
    return amount * 60 * 60 * 1000;
  }

  return amount * 24 * 60 * 60 * 1000;
}

function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bonusBalanceCents: user.bonusBalanceCents,
    role: user.role,
  };
}

@Injectable()
export class AuthService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenTtl: string;
  private readonly refreshTokenTtl: string;
  private readonly secureCookies: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenSecret =
      this.configService.get<string>("ACCESS_TOKEN_SECRET") ?? DEFAULT_ACCESS_TOKEN_SECRET;
    this.refreshTokenSecret =
      this.configService.get<string>("REFRESH_TOKEN_SECRET") ?? DEFAULT_REFRESH_TOKEN_SECRET;
    this.accessTokenTtl =
      this.configService.get<string>("ACCESS_TOKEN_TTL") ?? DEFAULT_ACCESS_TOKEN_TTL;
    this.refreshTokenTtl =
      this.configService.get<string>("REFRESH_TOKEN_TTL") ?? DEFAULT_REFRESH_TOKEN_TTL;
    this.secureCookies = this.configService.get<string>("NODE_ENV") === "production";
  }

  createCsrfToken(response: Response) {
    const csrfToken = randomBytes(32).toString("hex");

    response.cookie(CSRF_TOKEN_COOKIE, csrfToken, {
      httpOnly: false,
      sameSite: "lax",
      secure: this.secureCookies,
      path: "/",
    });

    return { csrfToken };
  }

  async register(dto: RegisterDto, response: Response) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException("Email is already registered");
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS),
        name: dto.name,
        avatarUrl: dto.avatarUrl,
        role: UserRole.USER,
      },
    });

    await this.createSession(user, response);

    return {
      user: toPublicUser(user),
    };
  }

  async login(dto: LoginDto, response: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.createSession(user, response);

    return {
      user: toPublicUser(user),
    };
  }

  async refresh(refreshToken: string | undefined, response: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token is missing");
    }

    const payload = this.verifyRefreshToken(refreshToken);

    if (!payload.sessionId) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException("Session is not active");
    }

    if (session.refreshTokenHash !== hashToken(refreshToken)) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      this.clearAuthCookies(response);
      throw new UnauthorizedException("Refresh token was already rotated");
    }

    await this.rotateSession(session.id, session.user, response);

    return {
      user: toPublicUser(session.user),
    };
  }

  async logout(refreshToken: string | undefined, response: Response) {
    if (refreshToken) {
      try {
        const payload = this.verifyRefreshToken(refreshToken);

        if (payload.sessionId) {
          await this.prisma.session.updateMany({
            where: {
              id: payload.sessionId,
              revokedAt: null,
            },
            data: {
              revokedAt: new Date(),
            },
          });
        }
      } catch {
        // Logout should be idempotent: invalid cookies are still cleared below.
      }
    }

    this.clearAuthCookies(response);

    return { ok: true };
  }

  async getMe(accessToken: string | undefined) {
    if (!accessToken) {
      throw new UnauthorizedException("Access token is missing");
    }

    const payload = this.verifyAccessToken(accessToken);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return {
      user: toPublicUser(user),
    };
  }

  private async createSession(user: User, response: Response) {
    const sessionId = randomUUID();
    const refreshToken = this.signRefreshToken(user, sessionId);
    const expiresAt = new Date(Date.now() + parseDurationMs(this.refreshTokenTtl));

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt,
      },
    });

    this.setAuthCookies(response, this.signAccessToken(user), refreshToken, expiresAt);
  }

  private async rotateSession(sessionId: string, user: User, response: Response) {
    const refreshToken = this.signRefreshToken(user, sessionId);
    const expiresAt = new Date(Date.now() + parseDurationMs(this.refreshTokenTtl));

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: hashToken(refreshToken),
        expiresAt,
      },
    });

    this.setAuthCookies(response, this.signAccessToken(user), refreshToken, expiresAt);
  }

  private signAccessToken(user: User) {
    const payload: AuthTokenPayload = {
      sub: user.id,
      role: user.role,
      type: "access",
    };

    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenTtl as SignOptions["expiresIn"],
    });
  }

  private signRefreshToken(user: User, sessionId: string) {
    const payload: AuthTokenPayload = {
      sub: user.id,
      role: user.role,
      type: "refresh",
      sessionId,
    };

    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenTtl as SignOptions["expiresIn"],
      jwtid: randomUUID(),
    });
  }

  private verifyAccessToken(token: string) {
    const payload = jwt.verify(token, this.accessTokenSecret) as AuthTokenPayload;

    if (payload.type !== "access") {
      throw new UnauthorizedException("Invalid access token");
    }

    return payload;
  }

  private verifyRefreshToken(token: string) {
    const payload = jwt.verify(token, this.refreshTokenSecret) as AuthTokenPayload;

    if (payload.type !== "refresh") {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return payload;
  }

  private setAuthCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
    refreshExpiresAt: Date,
  ) {
    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.secureCookies,
      path: "/",
    });
    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.secureCookies,
      path: "/api/v1/auth",
      expires: refreshExpiresAt,
    });
  }

  private clearAuthCookies(response: Response) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, {
      path: "/",
    });
    response.clearCookie(REFRESH_TOKEN_COOKIE, {
      path: "/api/v1/auth",
    });
  }
}
