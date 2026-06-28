ALTER TABLE `customers` DROP FOREIGN KEY `customers_source_id_fkey`;
ALTER TABLE `customers` DROP INDEX `customers_source_id_idx`;
ALTER TABLE `customers` DROP COLUMN `source_id`;
