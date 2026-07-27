-- Add roles table
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

-- Insert default roles
INSERT IGNORE INTO `roles` (`id`, `name`, `display_name`, `description`, `permissions`, `created_at`, `updated_at`) VALUES
(1, 'superadmin', 'Super Admin', 'Full system access - Can manage all users and change roles', '["users:read","users:create","users:update","users:delete","roles:read","roles:update","orders:read","orders:update","orders:delete","products:read","products:create","products:update","products:delete","stats:read"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(2, 'admin', 'Admin', 'Admin dashboard access - Can manage orders and products', '["users:read","orders:read","orders:update","products:read","products:create","products:update","products:delete","stats:read"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(3, 'user', 'User', 'Regular user access - Can only view own orders', '["orders:read:own","products:read"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
