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
- idempotent seed с тестовыми категориями, товарами и пользователем;
- публичный Catalog API;
- JWT-аутентификация через HttpOnly cookies;
- CSRF-защита для unsafe HTTP methods;
- Cart API с anonymous cart, user cart и merge после входа.

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
- `Order`, `OrderItem`, `Payment`.

`OrderItem` хранит snapshot товара: название, slug, изображение и цену на момент оформления заказа. Это позволяет сохранять историю заказов даже после изменения товара.
`Payment` хранит mock-платёж и `idempotencyKey`, чтобы повторный запрос оплаты не создавал дубль.

Миграции и seed запускаются разработчиком вручную:

```bash
pnpm prisma:migrate:dev --name init_schema
pnpm prisma:migrate:dev --name checkout_api
pnpm db:seed
```

После seed доступен тестовый пользователь:

```text
email: demo@example.com
password: password123
```

Пароль в seed хранится как `bcrypt` hash. В репозитории находится только исходный тестовый пароль для локальной проверки demo-аккаунта.

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

GET  /api/v1/auth/csrf
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me

GET /api/v1/categories
GET /api/v1/categories/:slug
GET /api/v1/products
GET /api/v1/products/featured
GET /api/v1/products/:slug
GET /api/v1/products/search/suggestions

GET    /api/v1/cart
GET    /api/v1/cart/summary
POST   /api/v1/cart/items
PATCH  /api/v1/cart/items/:itemId
DELETE /api/v1/cart/items/:itemId
DELETE /api/v1/cart

POST /api/v1/orders
POST /api/v1/orders/:id/pay/mock
GET  /api/v1/orders
GET  /api/v1/orders/:id
```

`GET /api/v1/products` поддерживает query-параметры:

```text
category
search
brand
minPrice
maxPrice
inStock
sort
page
limit
```

Доступные варианты `sort`:

```text
newest
price-asc
price-desc
name-asc
```

Ответ списка товаров содержит:

```text
items
pagination
availableFilters
```

Публичный Catalog API возвращает только активные товары. Цены передаются в cents без преобразования в рубли.

## Cart API

Корзина хранится в PostgreSQL и является серверным источником истины для cart remote.

Если пользователь не авторизован, API создаёт anonymous cart и выставляет HttpOnly cookie:

```text
anonymous_cart_id
```

Если пользователь авторизован через `access_token`, API использует cart, связанную с `User`.
При `POST /api/v1/auth/register`, `POST /api/v1/auth/login` или первом запросе корзины с обеими
cookies anonymous cart сливается в user cart, одинаковые товары объединяются, quantity ограничивается
актуальным `Product.stock`, а anonymous cookie очищается.

Изменяющие cart-запросы защищены тем же CSRF flow, что и auth endpoints. Клиент должен отправлять:

```text
credentials: include
Origin: http://localhost:3000
X-CSRF-Token: <value from csrf_token cookie>
```

Ответ `GET /api/v1/cart` содержит:

```text
id
isAnonymous
items
summary.itemsCount
summary.totalQuantity
summary.subtotalCents
```

## Checkout API

Checkout доступен только авторизованному пользователю с `access_token` cookie.

`POST /api/v1/orders` создаёт заказ из текущей user cart в транзакции:

- читает cart и товары;
- проверяет, что товары активны и stock достаточен;
- пересчитывает цены на сервере;
- проверяет и списывает бонусы;
- создаёт `Order` и snapshot-строки `OrderItem`;
- уменьшает `Product.stock`;
- устанавливает статус `PENDING_PAYMENT`.

Клиент не передаёт итоговую стоимость заказа. Поля доставки и контактов приходят в body, а сумма
считается только на сервере.

`POST /api/v1/orders/:id/pay/mock` принимает `idempotencyKey`, переводит заказ в `PAID`, создаёт
mock `Payment` со статусом `SUCCEEDED`, очищает корзину и начисляет тестовые бонусы.

`GET /api/v1/orders` и `GET /api/v1/orders/:id` возвращают только заказы текущего пользователя.

## Auth и CSRF

Аутентификация использует две HttpOnly cookies:

```text
access_token
refresh_token
```

Refresh token хранится в БД только как hash в модели `Session`. При каждом `POST /api/v1/auth/refresh` refresh token ротируется, а повторное использование старого refresh token приводит к отказу и отзыву сессии.

Для `POST`, `PUT`, `PATCH` и `DELETE` включена CSRF-защита:

1. клиент вызывает `GET /api/v1/auth/csrf`;
2. API устанавливает non-HttpOnly cookie `csrf_token`;
3. для unsafe-запросов клиент отправляет тот же токен в заголовке `X-CSRF-Token`;
4. API сравнивает cookie и заголовок, а также проверяет `Origin` против `FRONTEND_ORIGIN`.

Пример локального flow:

```bash
curl -i http://localhost:4000/api/v1/auth/csrf
```

После этого frontend должен отправлять `csrf_token` cookie и заголовок:

```text
X-CSRF-Token: <value from csrf_token cookie>
Origin: http://localhost:3000
```

На этапе локальной разработки `FRONTEND_ORIGIN` по умолчанию:

```text
http://localhost:3000
```

В `development` и `test` режимах дополнительно разрешён Swagger UI origin
`http://localhost:4000`, а API-клиенты без `Origin` header, например Postman, могут выполнять
unsafe-запросы при наличии корректной пары `csrf_token` cookie и `X-CSRF-Token` header. В
`production` отсутствие или несовпадение `Origin` отклоняется.

## OpenAPI

Swagger UI доступен локально по адресу:

```text
http://localhost:4000/api/docs
```

JSON-контракт для генерации типов фронтенда хранится в:

```text
openapi/openapi.json
```

Обновить контракт можно командой:

```bash
pnpm openapi:generate
```

Фронтенд-приложения смогут генерировать типы из этого файла через `openapi-typescript` или похожий инструмент. Конкретную команду генерации добавим в consumer-репозиториях, когда будем подключать первый фронт к API.

## Проверки

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm prisma:validate
pnpm prisma:generate
pnpm openapi:generate
pnpm build
```
