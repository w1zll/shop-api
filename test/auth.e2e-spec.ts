import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Session, User, UserRole } from "@prisma/client";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../src/common/cookies";
import { PrismaService } from "../src/prisma/prisma.service";

const allowedOrigin = "http://localhost:3000";

type StoredSession = Session;

interface RegisterResult {
  csrfCookie: string;
  csrfToken: string;
  accessCookie: string;
  refreshCookie: string;
  body: unknown;
}

function parseSetCookie(response: request.Response, name: string): string {
  const headers = response.headers as Record<string, string | string[] | undefined>;
  const setCookie = headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : [];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));

  if (!cookie) {
    throw new Error(`Cookie ${name} was not set`);
  }

  return cookie.split(";")[0];
}

function getCookieValue(cookie: string): string {
  const value = cookie.split("=")[1];

  if (!value) {
    throw new Error(`Cookie value is missing: ${cookie}`);
  }

  return value;
}

function createPrismaMock() {
  const users: User[] = [];
  const sessions: StoredSession[] = [];

  return {
    users,
    sessions,
    prisma: {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
      user: {
        findUnique: jest
          .fn()
          .mockImplementation((args: { where: { email?: string; id?: string } }) => {
            const { email, id } = args.where;
            return Promise.resolve(
              users.find((user) => user.email === email || user.id === id) ?? null,
            );
          }),
        create: jest.fn().mockImplementation(
          (args: {
            data: {
              email: string;
              passwordHash: string;
              name: string;
              avatarUrl?: string;
              role: UserRole;
            };
          }) => {
            const user: User = {
              id: `user-${String(users.length + 1)}`,
              email: args.data.email,
              passwordHash: args.data.passwordHash,
              name: args.data.name,
              avatarUrl: args.data.avatarUrl ?? null,
              bonusBalanceCents: 0,
              role: args.data.role,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            users.push(user);
            return Promise.resolve(user);
          },
        ),
      },
      session: {
        create: jest.fn().mockImplementation((args: { data: StoredSession }) => {
          sessions.push({ ...args.data, revokedAt: null });
          return Promise.resolve(sessions.at(-1));
        }),
        findUnique: jest
          .fn()
          .mockImplementation((args: { where: { id: string }; include?: { user?: boolean } }) => {
            const session = sessions.find((item) => item.id === args.where.id);

            if (!session) {
              return Promise.resolve(null);
            }

            if (args.include?.user) {
              const user = users.find((item) => item.id === session.userId);
              return Promise.resolve({ ...session, user });
            }

            return Promise.resolve(session);
          }),
        update: jest
          .fn()
          .mockImplementation((args: { where: { id: string }; data: Partial<StoredSession> }) => {
            const index = sessions.findIndex((session) => session.id === args.where.id);

            if (index === -1) {
              throw new Error("Session not found");
            }

            sessions[index] = { ...sessions[index], ...args.data };
            return Promise.resolve(sessions[index]);
          }),
        updateMany: jest
          .fn()
          .mockImplementation(
            (args: { where: { id: string; revokedAt?: null }; data: Partial<StoredSession> }) => {
              const session = sessions.find((item) => item.id === args.where.id);

              if (session && (args.where.revokedAt !== null || session.revokedAt === null)) {
                Object.assign(session, args.data);
                return Promise.resolve({ count: 1 });
              }

              return Promise.resolve({ count: 0 });
            },
          ),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      product: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    },
  };
}

describe("Auth endpoints", () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let store: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    store = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(store.prisma)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    // Nest exposes the underlying HTTP server as `any`; Supertest accepts this server shape.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    server = app.getHttpServer();
  });

  afterEach(async () => {
    await app.close();
  });

  async function getCsrfCookie(): Promise<string> {
    const response = await request(server).get("/api/v1/auth/csrf").expect(200);

    return parseSetCookie(response, CSRF_TOKEN_COOKIE);
  }

  async function registerUser(email = "demo@example.com"): Promise<RegisterResult> {
    const csrfCookie = await getCsrfCookie();
    const csrfToken = getCookieValue(csrfCookie);

    const response = await request(server)
      .post("/api/v1/auth/register")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        email,
        password: "password123",
        name: "Demo User",
      })
      .expect(200);

    return {
      csrfCookie,
      csrfToken,
      accessCookie: parseSetCookie(response, ACCESS_TOKEN_COOKIE),
      refreshCookie: parseSetCookie(response, REFRESH_TOKEN_COOKIE),
      body: response.body as unknown,
    };
  }

  it("registers a user, creates a session and sets auth cookies", async () => {
    const result = await registerUser();

    expect(result.body).toMatchObject({
      user: {
        email: "demo@example.com",
        name: "Demo User",
      },
    });
    expect(store.users).toHaveLength(1);
    expect(store.sessions).toHaveLength(1);
    expect(result.accessCookie).toContain(`${ACCESS_TOKEN_COOKIE}=`);
    expect(result.refreshCookie).toContain(`${REFRESH_TOKEN_COOKIE}=`);
  });

  it("returns current user by access cookie", async () => {
    const registered = await registerUser();

    await request(server)
      .get("/api/v1/auth/me")
      .set("Cookie", registered.accessCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          user: {
            email: "demo@example.com",
            name: "Demo User",
          },
        });
      });
  });

  it("rejects duplicate email", async () => {
    await registerUser();
    const csrfCookie = await getCsrfCookie();
    const csrfToken = getCookieValue(csrfCookie);

    await request(server)
      .post("/api/v1/auth/register")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        email: "demo@example.com",
        password: "password123",
        name: "Demo User",
      })
      .expect(409);
  });

  it("rejects wrong password", async () => {
    await registerUser();
    const csrfCookie = await getCsrfCookie();
    const csrfToken = getCookieValue(csrfCookie);

    await request(server)
      .post("/api/v1/auth/login")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        email: "demo@example.com",
        password: "wrong-password",
      })
      .expect(401);
  });

  it("rotates refresh token and rejects reused old refresh token", async () => {
    const registered = await registerUser();

    const refreshResponse = await request(server)
      .post("/api/v1/auth/refresh")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", registered.csrfToken)
      .set("Cookie", [registered.csrfCookie, registered.refreshCookie])
      .expect(200);

    const rotatedRefreshCookie = parseSetCookie(refreshResponse, REFRESH_TOKEN_COOKIE);

    expect(rotatedRefreshCookie).not.toBe(registered.refreshCookie);

    await request(server)
      .post("/api/v1/auth/refresh")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", registered.csrfToken)
      .set("Cookie", [registered.csrfCookie, registered.refreshCookie])
      .expect(401);
  });

  it("logs out and revokes current session", async () => {
    const registered = await registerUser();

    await request(server)
      .post("/api/v1/auth/logout")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", registered.csrfToken)
      .set("Cookie", [registered.csrfCookie, registered.refreshCookie])
      .expect(200);

    expect(store.sessions[0]?.revokedAt).toBeInstanceOf(Date);

    await request(server)
      .post("/api/v1/auth/refresh")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", registered.csrfToken)
      .set("Cookie", [registered.csrfCookie, registered.refreshCookie])
      .expect(401);
  });

  it("rejects expired session", async () => {
    const registered = await registerUser();
    store.sessions[0] = {
      ...store.sessions[0],
      expiresAt: new Date(Date.now() - 1000),
    };

    await request(server)
      .post("/api/v1/auth/refresh")
      .set("Origin", allowedOrigin)
      .set("X-CSRF-Token", registered.csrfToken)
      .set("Cookie", [registered.csrfCookie, registered.refreshCookie])
      .expect(401);
  });

  it("rejects unsafe requests without CSRF token", async () => {
    await request(server)
      .post("/api/v1/auth/register")
      .set("Origin", allowedOrigin)
      .send({
        email: "demo@example.com",
        password: "password123",
        name: "Demo User",
      })
      .expect(403);
  });

  it("rejects unsafe requests with wrong Origin", async () => {
    const csrfCookie = await getCsrfCookie();
    const csrfToken = getCookieValue(csrfCookie);

    await request(server)
      .post("/api/v1/auth/register")
      .set("Origin", "https://evil.example")
      .set("X-CSRF-Token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        email: "demo@example.com",
        password: "password123",
        name: "Demo User",
      })
      .expect(403);
  });
});
