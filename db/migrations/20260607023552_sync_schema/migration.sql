/*
  Warnings:

  - You are about to drop the column `sheets` on the `accsmarkets` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `problem_spreadsheet_id` on the `sources` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `accounts` DROP FOREIGN KEY `fk_account_source`;

-- DropForeignKey
ALTER TABLE `accsmarkets` DROP FOREIGN KEY `fk_accsmarket_source`;

-- DropForeignKey
ALTER TABLE `customers` DROP FOREIGN KEY `fk_customer_source`;

-- DropForeignKey
ALTER TABLE `expenses` DROP FOREIGN KEY `fk_expense_category`;

-- DropForeignKey
ALTER TABLE `expenses` DROP FOREIGN KEY `fk_expense_source`;

-- DropForeignKey
ALTER TABLE `sale_lines` DROP FOREIGN KEY `fk_sale_line_account`;

-- DropForeignKey
ALTER TABLE `sale_lines` DROP FOREIGN KEY `fk_sale_line_accsmarket`;

-- DropForeignKey
ALTER TABLE `sale_lines` DROP FOREIGN KEY `fk_sale_line_sale`;

-- DropForeignKey
ALTER TABLE `sales` DROP FOREIGN KEY `fk_sale_customer`;

-- DropForeignKey
ALTER TABLE `sales` DROP FOREIGN KEY `fk_sale_source`;

-- AlterTable
ALTER TABLE `accounts` MODIFY `capital` DOUBLE NULL;

-- AlterTable
ALTER TABLE `accsmarkets` DROP COLUMN `sheets`,
    MODIFY `capital` DOUBLE NULL,
    MODIFY `year` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `customers` DROP COLUMN `source`;

-- AlterTable
ALTER TABLE `expenses` MODIFY `amount` DOUBLE NOT NULL,
    MODIFY `expense_date` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `orders` ALTER COLUMN `quantity` DROP DEFAULT;

-- AlterTable
ALTER TABLE `roles` ALTER COLUMN `display_name` DROP DEFAULT;

-- AlterTable
ALTER TABLE `sale_lines` MODIFY `unit_sale_price` DOUBLE NULL,
    MODIFY `price` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `profit` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sales` MODIFY `customer_id` INTEGER NULL,
    MODIFY `total_sale_price` DOUBLE NOT NULL,
    MODIFY `total_profit` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `sources` DROP COLUMN `problem_spreadsheet_id`,
    ADD COLUMN `is_accsmarket` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `stocks` MODIFY `password_email` TEXT NULL,
    MODIFY `password` TEXT NOT NULL,
    MODIFY `two_factor_code` TEXT NULL;

-- CreateIndex
CREATE INDEX `accounts_account_status_idx` ON `accounts`(`account_status`);

-- CreateIndex
CREATE INDEX `accsmarkets_account_status_idx` ON `accsmarkets`(`account_status`);

-- CreateIndex
CREATE INDEX `customers_username_shopee_idx` ON `customers`(`username_shopee`);

-- CreateIndex
CREATE INDEX `sales_is_shopee_idx` ON `sales`(`is_shopee`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_referred_by_id_fkey` FOREIGN KEY (`referred_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_section_id_fkey` FOREIGN KEY (`section_id`) REFERENCES `product_sections`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stocks` ADD CONSTRAINT `stocks_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stocks` ADD CONSTRAINT `stocks_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `channels` ADD CONSTRAINT `channels_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posts` ADD CONSTRAINT `posts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posts` ADD CONSTRAINT `posts_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accsmarkets` ADD CONSTRAINT `accsmarkets_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_lines` ADD CONSTRAINT `sale_lines_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_lines` ADD CONSTRAINT `sale_lines_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_lines` ADD CONSTRAINT `sale_lines_accsmarket_id_fkey` FOREIGN KEY (`accsmarket_id`) REFERENCES `accsmarkets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_source_id_fkey` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `testimonials` ADD CONSTRAINT `testimonials_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `testimonials` ADD CONSTRAINT `testimonials_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `accounts` RENAME INDEX `idx_email` TO `accounts_email_idx`;

-- RenameIndex
ALTER TABLE `accounts` RENAME INDEX `idx_is_sold` TO `accounts_is_sold_idx`;

-- RenameIndex
ALTER TABLE `accounts` RENAME INDEX `idx_order_index` TO `accounts_order_index_idx`;

-- RenameIndex
ALTER TABLE `accounts` RENAME INDEX `idx_source_id` TO `accounts_source_id_idx`;

-- RenameIndex
ALTER TABLE `accounts` RENAME INDEX `idx_username` TO `accounts_username_idx`;

-- RenameIndex
ALTER TABLE `accounts` RENAME INDEX `unique_email` TO `accounts_email_key`;

-- RenameIndex
ALTER TABLE `accounts` RENAME INDEX `unique_username` TO `accounts_username_key`;

-- RenameIndex
ALTER TABLE `accsmarkets` RENAME INDEX `idx_email` TO `accsmarkets_email_idx`;

-- RenameIndex
ALTER TABLE `accsmarkets` RENAME INDEX `idx_is_sold` TO `accsmarkets_is_sold_idx`;

-- RenameIndex
ALTER TABLE `accsmarkets` RENAME INDEX `idx_order_index` TO `accsmarkets_order_index_idx`;

-- RenameIndex
ALTER TABLE `accsmarkets` RENAME INDEX `idx_source_id` TO `accsmarkets_source_id_idx`;

-- RenameIndex
ALTER TABLE `accsmarkets` RENAME INDEX `idx_username` TO `accsmarkets_username_idx`;

-- RenameIndex
ALTER TABLE `accsmarkets` RENAME INDEX `unique_email` TO `accsmarkets_email_key`;

-- RenameIndex
ALTER TABLE `accsmarkets` RENAME INDEX `unique_username` TO `accsmarkets_username_key`;

-- RenameIndex
ALTER TABLE `bank_accounts` RENAME INDEX `idx_is_active` TO `bank_accounts_is_active_idx`;

-- RenameIndex
ALTER TABLE `channels` RENAME INDEX `idx_social_bu_id` TO `channels_social_bu_id_idx`;

-- RenameIndex
ALTER TABLE `channels` RENAME INDEX `idx_user_id` TO `channels_user_id_idx`;

-- RenameIndex
ALTER TABLE `channels` RENAME INDEX `social_bu_id` TO `channels_social_bu_id_key`;

-- RenameIndex
ALTER TABLE `customers` RENAME INDEX `idx_created_at` TO `customers_created_at_idx`;

-- RenameIndex
ALTER TABLE `customers` RENAME INDEX `idx_source_id` TO `customers_source_id_idx`;

-- RenameIndex
ALTER TABLE `expenses` RENAME INDEX `idx_category_id` TO `expenses_category_id_idx`;

-- RenameIndex
ALTER TABLE `expenses` RENAME INDEX `idx_expense_date` TO `expenses_expense_date_idx`;

-- RenameIndex
ALTER TABLE `expenses` RENAME INDEX `idx_source_id` TO `expenses_source_id_idx`;

-- RenameIndex
ALTER TABLE `orders` RENAME INDEX `idx_bank_account_id` TO `orders_bank_account_id_idx`;

-- RenameIndex
ALTER TABLE `orders` RENAME INDEX `idx_group_id` TO `orders_group_id_idx`;

-- RenameIndex
ALTER TABLE `orders` RENAME INDEX `idx_product_id` TO `orders_product_id_idx`;

-- RenameIndex
ALTER TABLE `orders` RENAME INDEX `idx_status` TO `orders_status_idx`;

-- RenameIndex
ALTER TABLE `orders` RENAME INDEX `idx_user_id` TO `orders_user_id_idx`;

-- RenameIndex
ALTER TABLE `posts` RENAME INDEX `idx_channel_id` TO `posts_channel_id_idx`;

-- RenameIndex
ALTER TABLE `posts` RENAME INDEX `idx_created_at` TO `posts_created_at_idx`;

-- RenameIndex
ALTER TABLE `posts` RENAME INDEX `idx_scheduled_time` TO `posts_scheduled_time_idx`;

-- RenameIndex
ALTER TABLE `posts` RENAME INDEX `idx_status` TO `posts_status_idx`;

-- RenameIndex
ALTER TABLE `posts` RENAME INDEX `idx_user_id` TO `posts_user_id_idx`;

-- RenameIndex
ALTER TABLE `posts` RENAME INDEX `social_bu_id` TO `posts_social_bu_id_key`;

-- RenameIndex
ALTER TABLE `product_sections` RENAME INDEX `idx_order` TO `product_sections_order_index_idx`;

-- RenameIndex
ALTER TABLE `products` RENAME INDEX `idx_in_stock` TO `products_in_stock_idx`;

-- RenameIndex
ALTER TABLE `products` RENAME INDEX `idx_section_id` TO `products_section_id_idx`;

-- RenameIndex
ALTER TABLE `roles` RENAME INDEX `idx_name` TO `roles_name_idx`;

-- RenameIndex
ALTER TABLE `roles` RENAME INDEX `name` TO `roles_name_key`;

-- RenameIndex
ALTER TABLE `sale_lines` RENAME INDEX `idx_account_id` TO `sale_lines_account_id_idx`;

-- RenameIndex
ALTER TABLE `sale_lines` RENAME INDEX `idx_accsmarket_id` TO `sale_lines_accsmarket_id_idx`;

-- RenameIndex
ALTER TABLE `sale_lines` RENAME INDEX `idx_sale_id` TO `sale_lines_sale_id_idx`;

-- RenameIndex
ALTER TABLE `sales` RENAME INDEX `idx_created_at` TO `sales_created_at_idx`;

-- RenameIndex
ALTER TABLE `sales` RENAME INDEX `idx_customer_id` TO `sales_customer_id_idx`;

-- RenameIndex
ALTER TABLE `sales` RENAME INDEX `idx_source_id` TO `sales_source_id_idx`;

-- RenameIndex
ALTER TABLE `schedules` RENAME INDEX `idx_channel_id` TO `schedules_channel_id_idx`;

-- RenameIndex
ALTER TABLE `schedules` RENAME INDEX `idx_user_id` TO `schedules_user_id_idx`;

-- RenameIndex
ALTER TABLE `sources` RENAME INDEX `idx_index` TO `sources_index_idx`;

-- RenameIndex
ALTER TABLE `stocks` RENAME INDEX `idx_order_id` TO `stocks_order_id_idx`;

-- RenameIndex
ALTER TABLE `stocks` RENAME INDEX `idx_product_id` TO `stocks_product_id_idx`;

-- RenameIndex
ALTER TABLE `stocks` RENAME INDEX `idx_status` TO `stocks_status_idx`;

-- RenameIndex
ALTER TABLE `testimonials` RENAME INDEX `idx_is_published` TO `testimonials_is_published_idx`;

-- RenameIndex
ALTER TABLE `testimonials` RENAME INDEX `idx_product_id` TO `testimonials_product_id_idx`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `email` TO `users_email_key`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `google_id` TO `users_google_id_key`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `idx_email` TO `users_email_idx`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `idx_google_id` TO `users_google_id_idx`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `idx_role_id` TO `users_role_id_idx`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `idx_source_id` TO `users_source_id_idx`;

