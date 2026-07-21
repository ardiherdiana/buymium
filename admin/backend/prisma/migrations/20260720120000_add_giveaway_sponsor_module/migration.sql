-- CreateTable
CREATE TABLE `giveaway_tiers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `target_followers` INTEGER NOT NULL,
    `price` DOUBLE NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `giveaway_tiers_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `giveaway_tier_price_histories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tier_id` INTEGER NOT NULL,
    `price` DOUBLE NOT NULL,
    `changed_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `giveaway_tier_price_histories_tier_id_idx`(`tier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `giveaway_sponsor_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_number` VARCHAR(255) NOT NULL,
    `customer_id` INTEGER NULL,
    `total_sale_price` DOUBLE NOT NULL,
    `is_shopee` BOOLEAN NOT NULL DEFAULT false,
    `shopee_order_number` VARCHAR(255) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `giveaway_sponsor_orders_customer_id_idx`(`customer_id`),
    INDEX `giveaway_sponsor_orders_is_shopee_idx`(`is_shopee`),
    INDEX `giveaway_sponsor_orders_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- CreateTable
CREATE TABLE `giveaway_sponsor_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `tier_id` INTEGER NOT NULL,
    `username` VARCHAR(255) NOT NULL,
    `current_followers` INTEGER NULL,
    `unit_sale_price` DOUBLE NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'progress',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `giveaway_sponsor_items_order_id_idx`(`order_id`),
    INDEX `giveaway_sponsor_items_tier_id_idx`(`tier_id`),
    INDEX `giveaway_sponsor_items_status_idx`(`status`),
    UNIQUE INDEX `giveaway_sponsor_items_username_tier_id_key`(`username`, `tier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- AddForeignKey
ALTER TABLE `giveaway_tier_price_histories` ADD CONSTRAINT `giveaway_tier_price_histories_tier_id_fkey` FOREIGN KEY (`tier_id`) REFERENCES `giveaway_tiers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_tier_price_histories` ADD CONSTRAINT `giveaway_tier_price_histories_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_sponsor_orders` ADD CONSTRAINT `giveaway_sponsor_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_sponsor_orders` ADD CONSTRAINT `giveaway_sponsor_orders_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_sponsor_items` ADD CONSTRAINT `giveaway_sponsor_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `giveaway_sponsor_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `giveaway_sponsor_items` ADD CONSTRAINT `giveaway_sponsor_items_tier_id_fkey` FOREIGN KEY (`tier_id`) REFERENCES `giveaway_tiers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
