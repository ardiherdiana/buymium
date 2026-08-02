-- AlterTable: add source_sheet_name ahead of the sources table removal (data.backfilled separately)
ALTER TABLE `sales` ADD COLUMN `source_sheet_name` VARCHAR(255) NULL AFTER `source_id`;
ALTER TABLE `products` ADD COLUMN `source_sheet_name` VARCHAR(255) NULL AFTER `source_id`;
