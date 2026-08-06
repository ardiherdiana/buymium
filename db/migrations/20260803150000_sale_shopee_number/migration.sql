-- Drop unused legacy sales.source_sheet_name column (superseded by sales.source_id relation)
ALTER TABLE `sales` DROP INDEX `sales_source_sheet_name_idx`;
ALTER TABLE `sales` DROP COLUMN `source_sheet_name`;

-- Add shopee_number for recording the Shopee order number on a sale
ALTER TABLE `sales` ADD COLUMN `shopee_number` VARCHAR(255) NULL AFTER `is_shopee`;
