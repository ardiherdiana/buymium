-- Drop unique constraints on email and username in accsmarkets table
-- These constraints block re-syncing accounts that were previously sold (isSold = true)

DROP INDEX `accsmarkets_email_key` ON `accsmarkets`;
DROP INDEX `accsmarkets_username_key` ON `accsmarkets`;
