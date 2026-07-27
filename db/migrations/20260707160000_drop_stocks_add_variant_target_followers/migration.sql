-- Upload Stok is retired: all products are now source-linked and stock comes from
-- Account/Accsmarket rows instead of manually-uploaded credentials.
ALTER TABLE `stocks` DROP FOREIGN KEY `stocks_product_id_fkey`;
ALTER TABLE `stocks` DROP FOREIGN KEY `stocks_order_id_fkey`;
ALTER TABLE `stocks` DROP FOREIGN KEY `stocks_variant_id_fkey`;

DROP TABLE `stocks`;

-- Price tiers (opsi) are now auto-detected from Account/Accsmarket targetFollowers values.
ALTER TABLE `product_variants`
  ADD COLUMN `target_followers` INT NULL;
