-- Upfoll orders are mirrored into Sale/SaleLine at creation time so they show
-- up in Finance > Sales and Analytics without those pages needing to know
-- about the Upfoll module.

-- AlterTable
ALTER TABLE `upfoll_orders` ADD COLUMN `sale_id` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `upfoll_orders_sale_id_key` ON `upfoll_orders`(`sale_id`);

-- AddForeignKey
ALTER TABLE `upfoll_orders` ADD CONSTRAINT `upfoll_orders_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
