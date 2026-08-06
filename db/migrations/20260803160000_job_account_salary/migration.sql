-- Track per-account salary (Rp4.000/akun once loginStatus = 'success') for job_accounts
ALTER TABLE `job_accounts`
  ADD COLUMN `salary_paid` BOOLEAN NOT NULL DEFAULT false AFTER `due_date`,
  ADD COLUMN `salary_proof_url` VARCHAR(255) NULL AFTER `salary_paid`,
  ADD COLUMN `salary_paid_at` DATETIME(3) NULL AFTER `salary_proof_url`;

CREATE INDEX `job_accounts_salary_paid_idx` ON `job_accounts`(`salary_paid`);
