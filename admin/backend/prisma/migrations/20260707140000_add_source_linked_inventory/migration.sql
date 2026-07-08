-- AlterTable: link a product 1:1 to a management Source (inventory-backed product)
ALTER TABLE `products`
  ADD COLUMN `source_id` INT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `products_source_id_key` ON `products`(`source_id`);

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: track which storefront order currently reserves an account (before it's marked sold)
ALTER TABLE `accounts`
  ADD COLUMN `reserved_order_id` INT NULL;

-- CreateIndex
CREATE INDEX `accounts_reserved_order_id_idx` ON `accounts`(`reserved_order_id`);

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_reserved_order_id_fkey` FOREIGN KEY (`reserved_order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `accsmarkets`
  ADD COLUMN `reserved_order_id` INT NULL;

-- CreateIndex
CREATE INDEX `accsmarkets_reserved_order_id_idx` ON `accsmarkets`(`reserved_order_id`);

-- AddForeignKey
ALTER TABLE `accsmarkets` ADD CONSTRAINT `accsmarkets_reserved_order_id_fkey` FOREIGN KEY (`reserved_order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: link a storefront order to the sale record created when it's confirmed
ALTER TABLE `sales`
  ADD COLUMN `order_id` INT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `sales_order_id_key` ON `sales`(`order_id`);

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: remember which account/accsmarket rows were consumed by an order (for credential download after sale)
ALTER TABLE `orders`
  ADD COLUMN `inventory_refs` TEXT NULL;
