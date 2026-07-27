-- Redesign: price moves from GiveawayTier to a per-(vendor, tier) price table,
-- so different vendors can charge different prices for the same follower tier.
-- The prior giveaway_sponsor_module tables were only just introduced and hold
-- no production data yet, so this drops and recreates rather than altering.

-- DropForeignKey
ALTER TABLE `giveaway_tier_price_histories` DROP FOREIGN KEY `giveaway_tier_price_histories_tier_id_fkey`;
ALTER TABLE `giveaway_tier_price_histories` DROP FOREIGN KEY `giveaway_tier_price_histories_changed_by_fkey`;
ALTER TABLE `giveaway_sponsor_items` DROP FOREIGN KEY `giveaway_sponsor_items_order_id_fkey`;
ALTER TABLE `giveaway_sponsor_items` DROP FOREIGN KEY `giveaway_sponsor_items_tier_id_fkey`;

-- DropTable
DROP TABLE `giveaway_tier_price_histories`;
DROP TABLE `giveaway_sponsor_items`;
DROP TABLE `giveaway_tiers`;

-- CreateTable
CREATE TABLE `giveaway_tiers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `target_followers` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `giveaway_tiers_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `giveaway_vendors` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `giveaway_vendors_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `giveaway_vendor_tier_prices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendor_id` INTEGER NOT NULL,
    `tier_id` INTEGER NOT NULL,
    `price` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `giveaway_vendor_tier_prices_vendor_id_idx`(`vendor_id`),
    INDEX `giveaway_vendor_tier_prices_tier_id_idx`(`tier_id`),
    UNIQUE INDEX `giveaway_vendor_tier_prices_vendor_id_tier_id_key`(`vendor_id`, `tier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `giveaway_vendor_tier_price_histories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vendor_tier_price_id` INTEGER NOT NULL,
    `price` DOUBLE NOT NULL,
    `changed_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `giveaway_vendor_tier_price_histories_vendor_tier_price_id_idx`(`vendor_tier_price_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `giveaway_sponsor_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `tier_id` INTEGER NOT NULL,
    `vendor_id` INTEGER NOT NULL,
    `username` VARCHAR(255) NOT NULL,
    `current_followers` INTEGER NULL,
    `capital` DOUBLE NOT NULL DEFAULT 0,
    `unit_sale_price` DOUBLE NOT NULL,
    `profit` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'progress',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `giveaway_sponsor_items_order_id_idx`(`order_id`),
    INDEX `giveaway_sponsor_items_tier_id_idx`(`tier_id`),
    INDEX `giveaway_sponsor_items_vendor_id_idx`(`vendor_id`),
    INDEX `giveaway_sponsor_items_status_idx`(`status`),
    UNIQUE INDEX `giveaway_sponsor_items_username_tier_id_key`(`username`, `tier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- AlterTable
ALTER TABLE `giveaway_sponsor_orders` ADD COLUMN `total_profit` DOUBLE NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE `giveaway_vendor_tier_prices` ADD CONSTRAINT `giveaway_vendor_tier_prices_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `giveaway_vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_vendor_tier_prices` ADD CONSTRAINT `giveaway_vendor_tier_prices_tier_id_fkey` FOREIGN KEY (`tier_id`) REFERENCES `giveaway_tiers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_vendor_tier_price_histories` ADD CONSTRAINT `giveaway_vendor_tier_price_histories_vendor_tier_price_id_fkey` FOREIGN KEY (`vendor_tier_price_id`) REFERENCES `giveaway_vendor_tier_prices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_vendor_tier_price_histories` ADD CONSTRAINT `giveaway_vendor_tier_price_histories_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_sponsor_items` ADD CONSTRAINT `giveaway_sponsor_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `giveaway_sponsor_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_sponsor_items` ADD CONSTRAINT `giveaway_sponsor_items_tier_id_fkey` FOREIGN KEY (`tier_id`) REFERENCES `giveaway_tiers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_sponsor_items` ADD CONSTRAINT `giveaway_sponsor_items_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `giveaway_vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
