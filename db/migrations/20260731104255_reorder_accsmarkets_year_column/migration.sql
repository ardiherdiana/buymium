-- Reorder `year` (Tahun Dibuat) to sit right after `two_factor_auth`,
-- matching the unified sheet header order and the `accounts` table layout.
ALTER TABLE `accsmarkets` MODIFY COLUMN `year` VARCHAR(255) NULL AFTER `two_factor_auth`;
