-- AlterTable: product photo + variation group label
ALTER TABLE `products`
  ADD COLUMN `image_url` VARCHAR(500) NULL,
  ADD COLUMN `variant_label` VARCHAR(100) NULL;

-- AlterTable: link stock/credential rows to a specific price variant (opsi)
ALTER TABLE `stocks`
  ADD COLUMN `variant_id` INT NULL;

-- CreateIndex
CREATE INDEX `stocks_variant_id_idx` ON `stocks`(`variant_id`);

-- AddForeignKey
ALTER TABLE `stocks` ADD CONSTRAINT `stocks_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
