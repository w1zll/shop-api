import "reflect-metadata";

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { NestFactory } from "@nestjs/core";
import { format } from "prettier";

import { AppModule } from "../src/app.module";
import { createOpenApiDocument } from "../src/openapi/openapi";

async function main() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  app.setGlobalPrefix("api/v1");

  const document = createOpenApiDocument(app);
  const outputPath = join(process.cwd(), "openapi", "openapi.json");
  const formattedDocument = await format(JSON.stringify(document), {
    parser: "json",
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, formattedDocument, "utf8");
  await app.close();

  console.info(`OpenAPI contract generated: ${outputPath}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
