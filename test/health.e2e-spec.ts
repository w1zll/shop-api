import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Health endpoints", () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
      })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    // Nest exposes the underlying HTTP server as `any`; Supertest accepts this server shape.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/health", async () => {
    await request(server)
      .get("/api/v1/health")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: "ok",
          service: "shop-api",
        });
      });
  });

  it("GET /api/v1/health/database", async () => {
    await request(server)
      .get("/api/v1/health/database")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: "ok",
          database: "postgresql",
        });
      });
  });
});
