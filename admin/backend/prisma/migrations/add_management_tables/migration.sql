-- Shared tables (created here for shadow DB compatibility)
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `display_name` VARCHAR(255) NOT NULL DEFAULT '',
  `description` TEXT,
  `permissions` LONGTEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role_id` INT NOT NULL DEFAULT 3,
  `source_id` INT,
  `google_id` VARCHAR(255) UNIQUE,
  `avatar` VARCHAR(500),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_email` (`email`),
  INDEX `idx_google_id` (`google_id`),
  INDEX `idx_role_id` (`role_id`),
  INDEX `idx_source_id` (`source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_sections` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `subtitle` TEXT NOT NULL,
  `order_index` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_order` (`order_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `products` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `title` TEXT NOT NULL,
  `description` TEXT NOT NULL,
  `in_stock` INT NOT NULL DEFAULT 0,
  `price` DOUBLE NOT NULL DEFAULT 0,
  `rating` DOUBLE NOT NULL DEFAULT 0,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `tags` VARCHAR(1000) NOT NULL DEFAULT '[]',
  `section_id` VARCHAR(100),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_in_stock` (`in_stock`),
  INDEX `idx_section_id` (`section_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bank_accounts` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `bank_name` VARCHAR(100) NOT NULL,
  `account_holder` VARCHAR(255) NOT NULL,
  `account_number` VARCHAR(50) NOT NULL,
  `logo` VARCHAR(500),
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `total_price` DOUBLE NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `group_id` VARCHAR(255),
  `payment_proof` VARCHAR(500),
  `proof_uploaded_at` DATETIME(3),
  `confirmed_at` DATETIME(3),
  `admin_note` TEXT,
  `bank_account_id` INT,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_group_id` (`group_id`),
  INDEX `idx_bank_account_id` (`bank_account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stocks` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `email` VARCHAR(255),
  `password_email` TEXT,
  `username` VARCHAR(255) NOT NULL,
  `password` TEXT NOT NULL,
  `two_factor_code` TEXT,
  `order_id` INT,
  `status` VARCHAR(50) NOT NULL DEFAULT 'available',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_order_id` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `testimonials` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `created_by_id` INT NOT NULL,
  `customer_name` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `rating` INT NOT NULL DEFAULT 5,
  `avatar` VARCHAR(500),
  `is_published` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_is_published` (`is_published`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `channels` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `username` VARCHAR(255) NOT NULL,
  `type` VARCHAR(50),
  `profile_photo_path` VARCHAR(500),
  `social_bu_id` VARCHAR(255) UNIQUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_social_bu_id` (`social_bu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `posts` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `channel_id` INT NOT NULL,
  `caption` TEXT NOT NULL,
  `source` VARCHAR(255),
  `image_url` VARCHAR(500),
  `scheduled_time` DATETIME(3),
  `status` VARCHAR(50) NOT NULL DEFAULT 'drafted',
  `social_bu_id` VARCHAR(255) UNIQUE,
  `posted_at` DATETIME(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_channel_id` (`channel_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_scheduled_time` (`scheduled_time`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `schedules` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `channel_id` INT NOT NULL,
  `day` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `slots` LONGTEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_channel_id` (`channel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Management tables
CREATE TABLE IF NOT EXISTS `sources` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `index` INT NOT NULL DEFAULT 0,
  `spreadsheet_id` VARCHAR(500),
  `problem_spreadsheet_id` VARCHAR(500),
  `image` VARCHAR(500),
  `color` VARCHAR(50),
  `prefix` VARCHAR(10),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_index` (`index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accounts` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `order_index` INT,
  `email` VARCHAR(255),
  `username` VARCHAR(255),
  `password` VARCHAR(255),
  `target_followers` INT,
  `current_followers` INT,
  `account_status` VARCHAR(50),
  `login_app` VARCHAR(255),
  `capital` FLOAT,
  `phone_model` VARCHAR(255),
  `source_id` INT,
  `is_sold` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY `unique_email` (`email`),
  UNIQUE KEY `unique_username` (`username`),
  INDEX `idx_email` (`email`),
  INDEX `idx_username` (`username`),
  INDEX `idx_is_sold` (`is_sold`),
  INDEX `idx_source_id` (`source_id`),
  INDEX `idx_order_index` (`order_index`),
  CONSTRAINT `fk_account_source` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `accsmarkets` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `order_index` INT,
  `email` VARCHAR(255),
  `password_email` VARCHAR(255),
  `username` VARCHAR(255),
  `password` VARCHAR(255),
  `two_factor_auth` VARCHAR(255),
  `target_followers` INT,
  `current_followers` INT,
  `account_status` VARCHAR(50),
  `capital` FLOAT,
  `year` VARCHAR(50),
  `source_id` INT,
  `is_sold` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY `unique_email` (`email`),
  UNIQUE KEY `unique_username` (`username`),
  INDEX `idx_email` (`email`),
  INDEX `idx_username` (`username`),
  INDEX `idx_is_sold` (`is_sold`),
  INDEX `idx_source_id` (`source_id`),
  INDEX `idx_order_index` (`order_index`),
  CONSTRAINT `fk_accsmarket_source` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `username_shopee` VARCHAR(255),
  `nomor_hp` VARCHAR(20),
  `source` VARCHAR(255),
  `source_id` INT,
  `created_by` INT,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_source_id` (`source_id`),
  INDEX `idx_created_at` (`created_at`),
  CONSTRAINT `fk_customer_source` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `sales_number` VARCHAR(255) NOT NULL,
  `customer_id` INT NOT NULL,
  `total_sale_price` FLOAT NOT NULL,
  `total_profit` FLOAT NOT NULL,
  `is_shopee` BOOLEAN NOT NULL DEFAULT false,
  `source_id` INT,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_customer_id` (`customer_id`),
  INDEX `idx_source_id` (`source_id`),
  INDEX `idx_created_at` (`created_at`),
  CONSTRAINT `fk_sale_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sale_source` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sale_lines` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT NOT NULL,
  `account_id` INT,
  `accsmarket_id` INT,
  `unit_sale_price` FLOAT,
  `price` FLOAT NOT NULL DEFAULT 0,
  `profit` FLOAT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_sale_id` (`sale_id`),
  INDEX `idx_account_id` (`account_id`),
  INDEX `idx_accsmarket_id` (`accsmarket_id`),
  CONSTRAINT `fk_sale_line_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sale_line_account` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sale_line_accsmarket` FOREIGN KEY (`accsmarket_id`) REFERENCES `accsmarkets`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expense_categories` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expenses` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `category_id` INT NOT NULL,
  `amount` FLOAT NOT NULL,
  `expense_date` DATETIME NOT NULL,
  `source_id` INT,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_category_id` (`category_id`),
  INDEX `idx_source_id` (`source_id`),
  INDEX `idx_expense_date` (`expense_date`),
  CONSTRAINT `fk_expense_category` FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_expense_source` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
