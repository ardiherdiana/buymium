-- Redesign: tiers no longer live in a shared catalog — each vendor defines
-- its own tiers directly (giveaway_vendor_tiers merges the old giveaway_tiers +
-- giveaway_vendor_tier_prices). No production data exists yet for this module,
-- so this drops and recreates rather than migrating rows.

-- DropForeignKey
ALTER TABLE `giveaway_vendor_tier_prices` DROP FOREIGN KEY `giveaway_vendor_tier_prices_vendor_id_fkey`;
ALTER TABLE `giveaway_vendor_tier_prices` DROP FOREIGN KEY `giveaway_vendor_tier_prices_tier_id_fkey`;
ALTER TABLE `giveaway_vendor_tier_price_histories` DROP FOREIGN KEY `giveaway_vendor_tier_price_histories_vendor_tier_price_id_fkey`;
ALTER TABLE `giveaway_vendor_tier_price_histories` DROP FOREIGN KEY `giveaway_vendor_tier_price_histories_changed_by_fkey`;
ALTER TABLE `giveaway_sponsor_items` DROP FOREIGN KEY `giveaway_sponsor_items_order_id_fkey`;
ALTER TABLE `giveaway_sponsor_items` DROP FOREIGN KEY `giveaway_sponsor_items_tier_id_fkey`;
ALTER TABLE `giveaway_sponsor_items` DROP FOREIGN KEY `giveaway_sponsor_items_vendor_id_fkey`;

-- DropTable
DROP TABLE `giveaway_vendor_tier_price_histories`;
DROP TABLE `giveaway_sponsor_items`;
DROP TABLE `giveaway_vendor_tier_prices`;
DROP TABLE `giveaway_tiers`;

-- CreateTable
CREATE TABLE `giveaway_vendor_tiers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendor_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `target_followers` INTEGER NOT NULL,
    `price` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `giveaway_vendor_tiers_vendor_id_idx`(`vendor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `giveaway_vendor_tier_price_histories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendor_tier_id` INTEGER NOT NULL,
    `price` DOUBLE NOT NULL,
    `changed_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `giveaway_vendor_tier_price_histories_vendor_tier_id_idx`(`vendor_tier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `giveaway_sponsor_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `vendor_tier_id` INTEGER NOT NULL,
    `username` VARCHAR(255) NOT NULL,
    `current_followers` INTEGER NULL,
    `capital` DOUBLE NOT NULL DEFAULT 0,
    `unit_sale_price` DOUBLE NOT NULL,
    `profit` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'progress',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `giveaway_sponsor_items_order_id_idx`(`order_id`),
    INDEX `giveaway_sponsor_items_vendor_tier_id_idx`(`vendor_tier_id`),
    INDEX `giveaway_sponsor_items_status_idx`(`status`),
    UNIQUE INDEX `giveaway_sponsor_items_username_vendor_tier_id_key`(`username`, `vendor_tier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- AddForeignKey
ALTER TABLE `giveaway_vendor_tiers` ADD CONSTRAINT `giveaway_vendor_tiers_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `giveaway_vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_vendor_tier_price_histories` ADD CONSTRAINT `giveaway_vendor_tier_price_histories_vendor_tier_id_fkey` FOREIGN KEY (`vendor_tier_id`) REFERENCES `giveaway_vendor_tiers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_vendor_tier_price_histories` ADD CONSTRAINT `giveaway_vendor_tier_price_histories_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_sponsor_items` ADD CONSTRAINT `giveaway_sponsor_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `giveaway_sponsor_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_sponsor_items` ADD CONSTRAINT `giveaway_sponsor_items_vendor_tier_id_fkey` FOREIGN KEY (`vendor_tier_id`) REFERENCES `giveaway_vendor_tiers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
