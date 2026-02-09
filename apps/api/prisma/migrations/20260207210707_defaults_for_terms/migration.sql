-- AlterTable
ALTER TABLE "Term" ADD COLUMN     "defaultCategory" "ShoppingCategory",
ADD COLUMN     "defaultExtras" JSONB,
ADD COLUMN     "defaultQty" DOUBLE PRECISION,
ADD COLUMN     "defaultUnit" "ShoppingUnit";
