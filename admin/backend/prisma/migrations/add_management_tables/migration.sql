-- Add Source table
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

-- Add Account table
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

-- Add Accsmarket table
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
  `sheets` VARCHAR(255),
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

-- Add Customer table
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

-- Add Sale table
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

-- Add SaleLine table
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

-- Add ExpenseCategory table
CREATE TABLE IF NOT EXISTS `expense_categories` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add Expense table
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
