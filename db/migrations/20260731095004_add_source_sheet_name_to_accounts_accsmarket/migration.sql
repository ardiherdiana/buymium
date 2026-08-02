-- AlterTable
ALTER TABLE `accounts` ADD COLUMN `source_sheet_name` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `accsmarkets` ADD COLUMN `source_sheet_name` VARCHAR(255) NULL;
