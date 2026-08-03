-- Job tracking: employees log in / assign new email to purchased accounts,
-- synced from a dedicated Google Sheets spreadsheet (one tab per employee).
CREATE TABLE `job_sources` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `spreadsheet_id` VARCHAR(500) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `job_sources_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE TABLE `job_accounts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `job_source_id` INT NOT NULL,
  `employee_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `password_email` VARCHAR(255) NULL,
  `username` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NULL,
  `two_factor_auth` VARCHAR(255) NULL,
  `year` VARCHAR(255) NULL,
  `target_followers` INT NULL,
  `hp` VARCHAR(255) NULL,
  `aplikasi` VARCHAR(255) NULL,
  `capital` DOUBLE NULL,
  `job_type` VARCHAR(30) NOT NULL,
  `login_status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `purchase_date` DATE NULL,
  `due_date` DATE NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `job_accounts_job_source_id_username_key`(`job_source_id`, `username`),
  INDEX `job_accounts_employee_name_idx`(`employee_name`),
  INDEX `job_accounts_job_type_idx`(`job_type`),
  INDEX `job_accounts_login_status_idx`(`login_status`),
  INDEX `job_accounts_due_date_idx`(`due_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

ALTER TABLE `job_accounts` ADD CONSTRAINT `job_accounts_job_source_id_fkey` FOREIGN KEY (`job_source_id`) REFERENCES `job_sources`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
