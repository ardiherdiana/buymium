-- Data (accsmarkets -> accounts merge, source_sheet_name backfill) was already migrated
-- out-of-band before this migration. This migration only drops now-dead structure.

-- sale_lines: drop accsmarket_id (merged into account_id)
ALTER TABLE `sale_lines` DROP FOREIGN KEY `sale_lines_accsmarket_id_fkey`;
ALTER TABLE `sale_lines` DROP COLUMN `accsmarket_id`;

-- accounts: drop source_id (replaced by source_sheet_name)
ALTER TABLE `accounts` DROP FOREIGN KEY `accounts_source_id_fkey`;
ALTER TABLE `accounts` DROP COLUMN `source_id`;

-- products: drop source_id (replaced by source_sheet_name)
ALTER TABLE `products` DROP FOREIGN KEY `products_source_id_fkey`;
ALTER TABLE `products` DROP COLUMN `source_id`;
ALTER TABLE `products` ADD UNIQUE INDEX `products_source_sheet_name_key` (`source_sheet_name`);

-- sales: drop source_id (replaced by source_sheet_name)
ALTER TABLE `sales` DROP FOREIGN KEY `sales_source_id_fkey`;
ALTER TABLE `sales` DROP COLUMN `source_id`;
CREATE INDEX `sales_source_sheet_name_idx` ON `sales`(`source_sheet_name`);

-- Drop now-unused tables
DROP TABLE `accsmarkets`;
DROP TABLE `sources`;
