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
- health endpoints;
- Prisma schema для пользователей, каталога, корзины, заказов и избранного;
- idempotent seed с тестовыми категориями, товарами и пользователем.

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

## Prisma

Схема находится в `prisma/schema.prisma`.

Основные модели:

- `User`, `Session`;
- `Category`, `Product`, `ProductImage`;
- `Favorite`;
- `Cart`, `CartItem`;
- `Order`, `OrderItem`.

`OrderItem` хранит snapshot товара: название, slug, изображение и цену на момент оформления заказа. Это позволяет сохранять историю заказов даже после изменения товара.

Миграции и seed запускаются разработчиком вручную:

```bash
pnpm prisma:migrate:dev --name init_schema
pnpm db:seed
```

После seed доступен тестовый пользователь:

```text
email: demo@example.com
password: password123
```

Пароль в seed пока хранится как технический `sha256`-hash. На этапе auth он будет заменен на полноценный password hashing для реального login flow.

Для проверки данных можно открыть Prisma Studio:

```bash
pnpm prisma studio
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
pnpm prisma:validate
pnpm prisma:generate
pnpm build
```
