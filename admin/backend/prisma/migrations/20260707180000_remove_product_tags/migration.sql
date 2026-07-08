-- Product tags were cosmetic-only (never used for search/filtering/SEO) - remove.
ALTER TABLE `products` DROP COLUMN `tags`;
