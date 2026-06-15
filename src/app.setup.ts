import cookieParser from "cookie-parser";
import helmet from "helmet";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { CsrfMiddleware } from "./common/security/csrf.middleware";
import { setupOpenApi } from "./openapi/openapi";

interface ConfigureAppOptions {
  openApi?: boolean;
}

export function configureApp(app: INestApplication, options: ConfigureAppOptions = {}) {
  const configService = app.get(ConfigService);
  const csrfMiddleware = new CsrfMiddleware(configService);

  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.use(cookieParser());
  app.use(csrfMiddleware.use.bind(csrfMiddleware));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (options.openApi) {
    setupOpenApi(app);
  }
}
