import "dotenv/config";
import bcrypt from "bcryptjs";
import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://shop_mfs:change-me-local-password@localhost:5432/shop_mfs?schema=public";

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

type SeedCategory = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  parentSlug?: string;
};

type SeedProduct = {
  name: string;
  slug: string;
  description: string;
  brand: string;
  priceCents: number;
  oldPriceCents?: number;
  stock: number;
  isFeatured?: boolean;
  categorySlug: string;
  imageUrl: string;
  attributes: Prisma.InputJsonObject;
};

const categories: SeedCategory[] = [
  {
    name: "Электроника",
    slug: "electronics",
    description: "Гаджеты, умные устройства и аксессуары для работы и дома.",
    imageUrl:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Одежда",
    slug: "clothing",
    description: "Базовый гардероб, обувь и вещи для повседневных образов.",
    imageUrl:
      "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Дом",
    slug: "home",
    description: "Товары для кухни, хранения, освещения и уютного интерьера.",
    imageUrl:
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Красота",
    slug: "beauty",
    description: "Уход, косметика и полезные мелочи для ежедневных ритуалов.",
    imageUrl:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Спорт",
    slug: "sport",
    description: "Инвентарь, аксессуары и экипировка для активного режима.",
    imageUrl:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Книги",
    slug: "books",
    description: "Практичные книги про технологии, бизнес, дизайн и саморазвитие.",
    imageUrl:
      "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1200&q=80",
  },
];

const products = [
  {
    name: "Беспроводные наушники AirBeat Lite",
    slug: "airbeat-lite-headphones",
    description: "Легкие TWS-наушники с шумоподавлением и зарядным кейсом.",
    brand: "AirBeat",
    priceCents: 649000,
    oldPriceCents: 799000,
    stock: 42,
    isFeatured: true,
    categorySlug: "electronics",
    imageUrl:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
    attributes: { color: "black", batteryHours: 24, noiseCancelling: true },
  },
  {
    name: "Смарт-часы Pulse Pro",
    slug: "pulse-pro-smartwatch",
    description: "Часы с AMOLED-экраном, пульсометром и спортивными режимами.",
    brand: "Pulse",
    priceCents: 1299000,
    stock: 31,
    isFeatured: true,
    categorySlug: "electronics",
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
    attributes: { display: "AMOLED", waterResistant: true, batteryDays: 7 },
  },
  {
    name: "Портативная колонка SoundDrop",
    slug: "sounddrop-portable-speaker",
    description: "Компактная колонка с влагозащитой и насыщенным басом.",
    brand: "SoundDrop",
    priceCents: 499000,
    stock: 54,
    categorySlug: "electronics",
    imageUrl:
      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80",
    attributes: { powerWatts: 20, waterproof: "IPX7", batteryHours: 12 },
  },
  {
    name: "Механическая клавиатура KeyLab TKL",
    slug: "keylab-tkl-keyboard",
    description: "Компактная клавиатура с hot-swap переключателями и RGB.",
    brand: "KeyLab",
    priceCents: 859000,
    stock: 27,
    categorySlug: "electronics",
    imageUrl:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80",
    attributes: { layout: "TKL", switches: "brown", backlight: "RGB" },
  },
  {
    name: "Внешний аккумулятор Volt 20000",
    slug: "volt-20000-power-bank",
    description: "Power bank с USB-C PD и индикацией заряда.",
    brand: "Volt",
    priceCents: 399000,
    stock: 66,
    categorySlug: "electronics",
    imageUrl:
      "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=900&q=80",
    attributes: { capacityMah: 20000, usbC: true, fastCharge: true },
  },
  {
    name: "Веб-камера FocusCam 2K",
    slug: "focuscam-2k-webcam",
    description: "Камера для звонков и стримов с автофокусом и крышкой.",
    brand: "FocusCam",
    priceCents: 529000,
    stock: 23,
    categorySlug: "electronics",
    imageUrl:
      "https://images.unsplash.com/photo-1587614382346-4ec70e388b28?auto=format&fit=crop&w=900&q=80",
    attributes: { resolution: "2K", autofocus: true, microphone: true },
  },
  {
    name: "Худи Urban Basic",
    slug: "urban-basic-hoodie",
    description: "Плотное хлопковое худи свободного кроя на каждый день.",
    brand: "Urban",
    priceCents: 459000,
    stock: 38,
    isFeatured: true,
    categorySlug: "clothing",
    imageUrl:
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80",
    attributes: { material: "cotton", fit: "regular", season: "all" },
  },
  {
    name: "Футболка Core White",
    slug: "core-white-t-shirt",
    description: "Белая футболка из мягкого хлопка с усиленным воротом.",
    brand: "Core",
    priceCents: 159000,
    stock: 84,
    categorySlug: "clothing",
    imageUrl:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
    attributes: { material: "cotton", color: "white", fit: "straight" },
  },
  {
    name: "Джинсы Straight Denim",
    slug: "straight-denim-jeans",
    description: "Прямые джинсы средней посадки из плотного денима.",
    brand: "Denim Co",
    priceCents: 599000,
    oldPriceCents: 699000,
    stock: 29,
    categorySlug: "clothing",
    imageUrl:
      "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=80",
    attributes: { material: "denim", fit: "straight", color: "blue" },
  },
  {
    name: "Кроссовки Move Runner",
    slug: "move-runner-sneakers",
    description: "Легкие кроссовки с амортизирующей подошвой.",
    brand: "Move",
    priceCents: 749000,
    stock: 33,
    isFeatured: true,
    categorySlug: "clothing",
    imageUrl:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    attributes: { type: "sneakers", sole: "foam", color: "red" },
  },
  {
    name: "Рюкзак City Pack",
    slug: "city-pack-backpack",
    description: "Городской рюкзак с отделением для ноутбука до 15 дюймов.",
    brand: "City Pack",
    priceCents: 389000,
    stock: 46,
    categorySlug: "clothing",
    imageUrl:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80",
    attributes: { volumeLiters: 22, laptopSizeInches: 15, waterproof: false },
  },
  {
    name: "Кепка Minimal Logo",
    slug: "minimal-logo-cap",
    description: "Хлопковая кепка с регулировкой размера и лаконичным логотипом.",
    brand: "Minimal",
    priceCents: 129000,
    stock: 73,
    categorySlug: "clothing",
    imageUrl:
      "https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=900&q=80",
    attributes: { material: "cotton", adjustable: true, color: "beige" },
  },
  {
    name: "Настольная лампа Glow Desk",
    slug: "glow-desk-lamp",
    description: "Лампа с регулировкой яркости и теплой цветовой температурой.",
    brand: "Glow",
    priceCents: 279000,
    stock: 41,
    isFeatured: true,
    categorySlug: "home",
    imageUrl:
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80",
    attributes: { brightnessLevels: 5, colorTemperature: "warm", led: true },
  },
  {
    name: "Керамическая кружка Morning",
    slug: "morning-ceramic-mug",
    description: "Минималистичная кружка для кофе и чая объемом 350 мл.",
    brand: "Morning",
    priceCents: 79000,
    stock: 120,
    categorySlug: "home",
    imageUrl:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=80",
    attributes: { volumeMl: 350, material: "ceramic", dishwasherSafe: true },
  },
  {
    name: "Органайзер для стола ClearBox",
    slug: "clearbox-desk-organizer",
    description: "Модульный органайзер для канцелярии, кабелей и мелочей.",
    brand: "ClearBox",
    priceCents: 149000,
    stock: 58,
    categorySlug: "home",
    imageUrl:
      "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=900&q=80",
    attributes: { compartments: 6, material: "plastic", stackable: true },
  },
  {
    name: "Плед Soft Touch",
    slug: "soft-touch-throw-blanket",
    description: "Мягкий плед для дивана, кресла или прохладных вечеров.",
    brand: "Soft Touch",
    priceCents: 249000,
    stock: 35,
    categorySlug: "home",
    imageUrl:
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=900&q=80",
    attributes: { size: "140x200", material: "microfiber", color: "gray" },
  },
  {
    name: "Набор контейнеров Fresh Set",
    slug: "fresh-set-food-containers",
    description: "Контейнеры для хранения продуктов с герметичными крышками.",
    brand: "Fresh Set",
    priceCents: 189000,
    stock: 63,
    categorySlug: "home",
    imageUrl:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=80",
    attributes: { pieces: 5, microwaveSafe: true, material: "glass" },
  },
  {
    name: "Аромасвеча Cedar Night",
    slug: "cedar-night-candle",
    description: "Свеча с древесным ароматом и хлопковым фитилем.",
    brand: "Cedar Night",
    priceCents: 119000,
    stock: 49,
    categorySlug: "home",
    imageUrl:
      "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=80",
    attributes: { scent: "cedar", burnHours: 35, wax: "soy" },
  },
  {
    name: "Увлажняющий крем Aqua Daily",
    slug: "aqua-daily-face-cream",
    description: "Легкий крем для ежедневного ухода и восстановления барьера.",
    brand: "Aqua Daily",
    priceCents: 219000,
    stock: 52,
    isFeatured: true,
    categorySlug: "beauty",
    imageUrl:
      "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80",
    attributes: { volumeMl: 50, skinType: "all", fragranceFree: true },
  },
  {
    name: "Сыворотка Vitamin C",
    slug: "vitamin-c-serum",
    description: "Сыворотка с витамином C для ровного тона и сияния кожи.",
    brand: "Bright Lab",
    priceCents: 299000,
    stock: 40,
    categorySlug: "beauty",
    imageUrl:
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=80",
    attributes: { volumeMl: 30, active: "vitamin C", skinType: "normal" },
  },
  {
    name: "Матовая помада Rose Clay",
    slug: "rose-clay-matte-lipstick",
    description: "Стойкая помада с мягким финишем и комфортной текстурой.",
    brand: "Rose Clay",
    priceCents: 139000,
    stock: 67,
    categorySlug: "beauty",
    imageUrl:
      "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=900&q=80",
    attributes: { finish: "matte", shade: "rose", longWear: true },
  },
  {
    name: "Шампунь Balance Hair",
    slug: "balance-hair-shampoo",
    description: "Мягкий шампунь для частого использования без пересушивания.",
    brand: "Balance Hair",
    priceCents: 99000,
    stock: 91,
    categorySlug: "beauty",
    imageUrl:
      "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=900&q=80",
    attributes: { volumeMl: 300, sulfateFree: true, hairType: "normal" },
  },
  {
    name: "Патчи для глаз Hydro Lift",
    slug: "hydro-lift-eye-patches",
    description: "Гидрогелевые патчи для свежего взгляда и увлажнения.",
    brand: "Hydro Lift",
    priceCents: 169000,
    stock: 48,
    categorySlug: "beauty",
    imageUrl:
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80",
    attributes: { pairs: 30, active: "hyaluronic acid", cooling: true },
  },
  {
    name: "Кисть для макияжа Soft Blend",
    slug: "soft-blend-makeup-brush",
    description: "Универсальная кисть для пудровых и кремовых текстур.",
    brand: "Soft Blend",
    priceCents: 89000,
    stock: 74,
    categorySlug: "beauty",
    imageUrl:
      "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=900&q=80",
    attributes: { bristle: "synthetic", crueltyFree: true, size: "medium" },
  },
  {
    name: "Коврик для йоги Grip Mat",
    slug: "grip-mat-yoga",
    description: "Нескользящий коврик толщиной 6 мм для домашних тренировок.",
    brand: "Grip Mat",
    priceCents: 259000,
    stock: 44,
    isFeatured: true,
    categorySlug: "sport",
    imageUrl:
      "https://images.unsplash.com/photo-1592432678016-e910b452f9a2?auto=format&fit=crop&w=900&q=80",
    attributes: { thicknessMm: 6, nonSlip: true, material: "TPE" },
  },
  {
    name: "Гантели Neofit 2 кг",
    slug: "neofit-dumbbells-2kg",
    description: "Пара неопреновых гантелей для силовых и функциональных занятий.",
    brand: "Neofit",
    priceCents: 199000,
    stock: 57,
    categorySlug: "sport",
    imageUrl:
      "https://images.unsplash.com/photo-1517963628607-235ccdd5476c?auto=format&fit=crop&w=900&q=80",
    attributes: { weightKg: 2, pieces: 2, coating: "neoprene" },
  },
  {
    name: "Фитнес-бутылка Hydro 750",
    slug: "hydro-750-fitness-bottle",
    description: "Бутылка с мерной шкалой, ремешком и защитной крышкой.",
    brand: "Hydro",
    priceCents: 89000,
    stock: 100,
    categorySlug: "sport",
    imageUrl:
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80",
    attributes: { volumeMl: 750, bpaFree: true, leakProof: true },
  },
  {
    name: "Эспандер Power Band",
    slug: "power-band-resistance",
    description: "Резиновая петля для разминки, подтягиваний и реабилитации.",
    brand: "Power Band",
    priceCents: 129000,
    stock: 69,
    categorySlug: "sport",
    imageUrl:
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80",
    attributes: { resistance: "medium", material: "latex", lengthCm: 208 },
  },
  {
    name: "Скакалка Speed Rope",
    slug: "speed-rope-jump-rope",
    description: "Скакалка с подшипниками и регулируемой длиной троса.",
    brand: "Speed Rope",
    priceCents: 119000,
    stock: 61,
    categorySlug: "sport",
    imageUrl:
      "https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?auto=format&fit=crop&w=900&q=80",
    attributes: { adjustable: true, handle: "aluminum", cable: "steel" },
  },
  {
    name: "Сумка для тренировок Gym Duffel",
    slug: "gym-duffel-bag",
    description: "Вместительная спортивная сумка с отделением для обуви.",
    brand: "Gym Duffel",
    priceCents: 329000,
    stock: 25,
    categorySlug: "sport",
    imageUrl:
      "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&w=900&q=80",
    attributes: { volumeLiters: 35, shoePocket: true, waterproof: true },
  },
  {
    name: "Clean Architecture на практике",
    slug: "clean-architecture-practice-book",
    description: "Книга о границах модулей, зависимостях и поддерживаемом коде.",
    brand: "TechBooks",
    priceCents: 249000,
    stock: 32,
    isFeatured: true,
    categorySlug: "books",
    imageUrl:
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
    attributes: { pages: 384, language: "ru", format: "paperback" },
  },
  {
    name: "TypeScript для больших приложений",
    slug: "typescript-large-apps-book",
    description: "Практическое руководство по типам, архитектуре и tooling.",
    brand: "TechBooks",
    priceCents: 219000,
    stock: 45,
    categorySlug: "books",
    imageUrl:
      "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=900&q=80",
    attributes: { pages: 312, language: "ru", format: "paperback" },
  },
  {
    name: "Дизайн интерфейсов без шума",
    slug: "quiet-interface-design-book",
    description: "Книга о читаемых экранах, UX-паттернах и продуктовой ясности.",
    brand: "Design Press",
    priceCents: 189000,
    stock: 37,
    categorySlug: "books",
    imageUrl:
      "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=900&q=80",
    attributes: { pages: 256, language: "ru", format: "paperback" },
  },
  {
    name: "SEO для современных сайтов",
    slug: "seo-modern-web-book",
    description: "Практика метаданных, индексации и технической оптимизации.",
    brand: "Web Press",
    priceCents: 159000,
    stock: 28,
    categorySlug: "books",
    imageUrl:
      "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80",
    attributes: { pages: 220, language: "ru", format: "paperback" },
  },
  {
    name: "Product Thinking",
    slug: "product-thinking-book",
    description: "Как связывать пользовательские задачи, метрики и roadmap.",
    brand: "Product Lab",
    priceCents: 199000,
    stock: 34,
    categorySlug: "books",
    imageUrl:
      "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=80",
    attributes: { pages: 288, language: "ru", format: "hardcover" },
  },
  {
    name: "Node.js API Handbook",
    slug: "nodejs-api-handbook",
    description: "Справочник по построению HTTP API, тестам и наблюдаемости.",
    brand: "Backend Books",
    priceCents: 229000,
    stock: 39,
    categorySlug: "books",
    imageUrl:
      "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=900&q=80",
    attributes: { pages: 340, language: "ru", format: "paperback" },
  },
] satisfies SeedProduct[];

function createPasswordHash(password: string) {
  return bcrypt.hash(password, 12);
}

async function seedCategories() {
  const categoryBySlug = new Map<string, { id: string }>();

  for (const category of categories) {
    const parent = category.parentSlug ? categoryBySlug.get(category.parentSlug) : undefined;

    const savedCategory = await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        parentId: parent?.id,
      },
      update: {
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl,
        parentId: parent?.id,
      },
      select: { id: true },
    });

    categoryBySlug.set(category.slug, savedCategory);
  }

  return categoryBySlug;
}

async function seedProducts(categoryBySlug: Map<string, { id: string }>) {
  for (const product of products) {
    const category = categoryBySlug.get(product.categorySlug);

    if (!category) {
      throw new Error(`Category ${product.categorySlug} was not seeded`);
    }

    const savedProduct = await prisma.product.upsert({
      where: { slug: product.slug },
      create: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        brand: product.brand,
        priceCents: product.priceCents,
        oldPriceCents: product.oldPriceCents ?? null,
        stock: product.stock,
        isActive: true,
        isFeatured: product.isFeatured ?? false,
        attributes: product.attributes,
        categoryId: category.id,
      },
      update: {
        name: product.name,
        description: product.description,
        brand: product.brand,
        priceCents: product.priceCents,
        oldPriceCents: product.oldPriceCents ?? null,
        stock: product.stock,
        isActive: true,
        isFeatured: product.isFeatured ?? false,
        attributes: product.attributes,
        categoryId: category.id,
      },
      select: { id: true },
    });

    await prisma.productImage.deleteMany({
      where: { productId: savedProduct.id },
    });

    await prisma.productImage.create({
      data: {
        productId: savedProduct.id,
        url: product.imageUrl,
        alt: product.name,
        position: 0,
      },
    });
  }
}

async function seedTestUser() {
  await prisma.user.upsert({
    where: { email: "demo@example.com" },
    create: {
      email: "demo@example.com",
      passwordHash: await createPasswordHash("password123"),
      name: "Тестовый пользователь",
      avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Demo",
      bonusBalanceCents: 150000,
      role: UserRole.USER,
    },
    update: {
      passwordHash: await createPasswordHash("password123"),
      name: "Тестовый пользователь",
      avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Demo",
      bonusBalanceCents: 150000,
      role: UserRole.USER,
    },
  });
}

async function main() {
  const categoryBySlug = await seedCategories();
  await seedProducts(categoryBySlug);
  await seedTestUser();

  console.info(
    `Seed completed: ${String(categories.length)} categories, ${String(products.length)} products, 1 test user.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
