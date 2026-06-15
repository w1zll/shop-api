# Shop API

`shop-api` — NestJS API для демонстрационного магазина на микрофронтендах.

## Ответственность

- users и auth;
- catalog;
- cart;
- favorites;
- orders;
- mock payment;
- bonus balance;
- Swagger/OpenAPI;
- Prisma, migrations и seed.

На текущем этапе реализован bootstrap приложения:

- NestJS 11;
- Node.js 24;
- pnpm;
- TypeScript strict;
- ESLint и Prettier;
- Jest и Supertest;
- ConfigModule;
- Prisma service;
- Helmet;
- cookie-parser;
- global validation pipe;
- единый формат ошибок;
- Swagger по `/api/docs`;
- health endpoints.

## Локальная разработка

```bash
pnpm install
pnpm prisma:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

На Windows, если PowerShell блокирует `pnpm.ps1`, можно использовать `pnpm.cmd`.

## Переменные окружения

Создать локальный `.env` из `.env.example` и заполнить значения вручную.
Настоящие секреты не коммитятся.

```bash
cp .env.example .env
```

Для локального PostgreSQL из `shop-infra` `DATABASE_URL` может выглядеть так:

```text
postgresql://shop_mfs:your-local-password@localhost:5432/shop_mfs?schema=public
```

## Запуск

```bash
pnpm start:dev
```

API слушает `0.0.0.0` и локально доступен на:

```text
http://localhost:4000
```

## Endpoints

```text
GET /api/v1/health
GET /api/v1/health/database
GET /api/docs
```

## Проверки

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```
