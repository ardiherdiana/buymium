-- AlterTable
ALTER TABLE `orders`
  ADD COLUMN `payment_method` VARCHAR(50) NULL,
  ADD COLUMN `payment_gateway_ref` VARCHAR(100) NULL,
  ADD COLUMN `payment_session_id` VARCHAR(100) NULL,
  ADD COLUMN `payment_url` VARCHAR(500) NULL;
