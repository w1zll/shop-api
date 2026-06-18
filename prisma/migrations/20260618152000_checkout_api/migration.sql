-- AlterEnum
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "OrderStatus_new" AS ENUM (
    'PENDING_PAYMENT',
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'COMPLETED',
    'CANCELLED'
);

ALTER TABLE "Order"
    ALTER COLUMN "status" TYPE "OrderStatus_new"
    USING (
        CASE
            WHEN "status"::text = 'CREATED' THEN 'PENDING_PAYMENT'
            ELSE "status"::text
        END
    )::"OrderStatus_new";

ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";

ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';

-- AlterEnum
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" DROP DEFAULT;

CREATE TYPE "PaymentStatus_new" AS ENUM (
    'PENDING',
    'SUCCEEDED',
    'FAILED'
);

ALTER TABLE "Order"
    ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new"
    USING (
        CASE
            WHEN "paymentStatus"::text = 'PAID' THEN 'SUCCEEDED'
            WHEN "paymentStatus"::text = 'REFUNDED' THEN 'FAILED'
            ELSE "paymentStatus"::text
        END
    )::"PaymentStatus_new";

ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "PaymentStatus_old";

ALTER TABLE "Order" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
