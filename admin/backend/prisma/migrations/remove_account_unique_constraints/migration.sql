-- Drop unique constraints on email and username in accounts table
-- These constraints block re-syncing accounts that were previously sold (isSold = true)

DROP INDEX `accounts_email_key` ON `accounts`;
DROP INDEX `accounts_username_key` ON `accounts`;
