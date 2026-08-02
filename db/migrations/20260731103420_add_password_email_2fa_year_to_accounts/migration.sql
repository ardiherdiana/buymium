-- AlterTable
ALTER TABLE `accounts`
  ADD COLUMN `password_email` VARCHAR(255) NULL AFTER `email`,
  ADD COLUMN `two_factor_auth` VARCHAR(255) NULL AFTER `password`,
  ADD COLUMN `year` VARCHAR(255) NULL AFTER `two_factor_auth`;
