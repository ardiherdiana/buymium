-- Add Role table
CREATE TABLE `role` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `description` TEXT,
  `permissions` LONGTEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default roles
SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO `role` (`id`, `name`, `description`, `permissions`, `created_at`, `updated_at`) VALUES
(1, 'superadmin', 'Full system access - Can manage all users and change roles', '["users:read","users:create","users:update","users:delete","roles:read","roles:update","orders:read","orders:update","orders:delete","products:read","products:create","products:update","products:delete","stats:read"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(2, 'admin', 'Admin dashboard access - Can manage orders and products', '["users:read","orders:read","orders:update","products:read","products:create","products:update","products:delete","stats:read"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(3, 'user', 'Regular user access - Can only view own orders', '["orders:read:own","products:read"]', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- Update any users with invalid role_id to user (3)
UPDATE `user` SET `role_id` = 3 WHERE `role_id` NOT IN (1, 2, 3);

-- Add role_id foreign key constraint to user table
ALTER TABLE `user` ADD CONSTRAINT `fk_user_role` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE RESTRICT;

SET FOREIGN_KEY_CHECKS = 1;
