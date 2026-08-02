-- Reintroduce a `sources` master table (id, name, spreadsheet_id) so filtering in
-- Sales/Analytics/Accounts stays stable even when Google Sheet tabs get renamed.
-- Accsmarket stays merged into `accounts` (not reintroduced) — Source no longer has isAccsmarket.

CREATE TABLE `sources` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `spreadsheet_id` VARCHAR(500) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `sources_name_key` (`name`)
) DEFAULT CHARACTER SET utf8mb4;

-- Seed the 3 sources requested, each pointing at its own spreadsheet.
INSERT INTO `sources` (`name`, `spreadsheet_id`) VALUES
  ('MUDA', '1yDtHt2EAFDGA0gkg3xRLrzv_-XhtyMXAQxU7r0x53Ks'),
  ('TUA', '1riOQRkG-76-SdlvVw_cxK2igSoTpgcqtBWz_RLztxdg'),
  ('KONTEN', '1CeD7UYobDL8AjaHQ29mFo5TG-90MxTkKhPvC3zWKMhU');

-- accounts.source_id
ALTER TABLE `accounts` ADD COLUMN `source_id` INT NULL AFTER `source_sheet_name`;
UPDATE `accounts` SET `source_id` = (SELECT `id` FROM `sources` WHERE `name` = 'MUDA')
  WHERE `source_sheet_name` IN ('Buymium', 'Muda');
UPDATE `accounts` SET `source_id` = (SELECT `id` FROM `sources` WHERE `name` = 'TUA')
  WHERE `source_sheet_name` IN ('2FA', 'Hotmail', 'Tua');
UPDATE `accounts` SET `source_id` = (SELECT `id` FROM `sources` WHERE `name` = 'KONTEN')
  WHERE `source_sheet_name` = 'Konten';
CREATE INDEX `accounts_source_id_idx` ON `accounts`(`source_id`);
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- sales.source_id (source_sheet_name column is kept as historical detail)
ALTER TABLE `sales` ADD COLUMN `source_id` INT NULL AFTER `source_sheet_name`;
UPDATE `sales` SET `source_id` = (SELECT `id` FROM `sources` WHERE `name` = 'MUDA')
  WHERE `source_sheet_name` IN ('Buymium', 'Muda');
UPDATE `sales` SET `source_id` = (SELECT `id` FROM `sources` WHERE `name` = 'TUA')
  WHERE `source_sheet_name` IN ('2FA', 'Hotmail', 'Tua');
UPDATE `sales` SET `source_id` = (SELECT `id` FROM `sources` WHERE `name` = 'KONTEN')
  WHERE `source_sheet_name` = 'Konten';
CREATE INDEX `sales_source_id_idx` ON `sales`(`source_id`);
ALTER TABLE `sales` ADD CONSTRAINT `sales_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- products.source_id (replaces source_sheet_name entirely)
ALTER TABLE `products` ADD COLUMN `source_id` INT NULL AFTER `source_sheet_name`;
UPDATE `products` SET `source_id` = (SELECT `id` FROM `sources` WHERE `name` = 'MUDA')
  WHERE `source_sheet_name` = 'Buymium';
UPDATE `products` SET `source_id` = (SELECT `id` FROM `sources` WHERE `name` = 'TUA')
  WHERE `source_sheet_name` IN ('2FA', 'Hotmail');
UPDATE `products` SET `source_id` = (SELECT `id` FROM `sources` WHERE `name` = 'KONTEN')
  WHERE `source_sheet_name` = 'Konten';
ALTER TABLE `products` DROP INDEX `products_source_sheet_name_key`;
ALTER TABLE `products` DROP COLUMN `source_sheet_name`;
ALTER TABLE `products` ADD UNIQUE INDEX `products_source_id_key` (`source_id`);
ALTER TABLE `products` ADD CONSTRAINT `products_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
