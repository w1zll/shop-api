import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function createOpenApiDocument(app: INestApplication) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Shop API")
    .setDescription("API демонстрационного магазина на микрофронтендах")
    .setVersion("0.1.0")
    .addCookieAuth("access_token")
    .build();

  return SwaggerModule.createDocument(app, swaggerConfig);
}

export function setupOpenApi(app: INestApplication) {
  SwaggerModule.setup("api/docs", app, createOpenApiDocument(app));
}
