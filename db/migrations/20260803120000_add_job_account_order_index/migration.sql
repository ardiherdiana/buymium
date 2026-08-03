-- Sequential position within a sync run (mirrors accounts.order_index), so the
-- Job list shows rows in the same order they appear in the source sheet instead
-- of newest-synced-first.
ALTER TABLE `job_accounts` ADD COLUMN `order_index` INT NULL AFTER `id`;
CREATE INDEX `job_accounts_order_index_idx` ON `job_accounts`(`order_index`);
