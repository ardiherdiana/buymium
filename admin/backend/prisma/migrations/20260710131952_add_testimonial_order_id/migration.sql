-- AlterTable
ALTER TABLE `testimonials` ADD COLUMN `order_id` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `testimonials_order_id_key` ON `testimonials`(`order_id`);
