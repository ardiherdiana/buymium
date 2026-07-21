-- Price history feature removed from the Upfoll Vendors page.

-- DropForeignKey
ALTER TABLE `upfoll_vendor_tier_price_histories` DROP FOREIGN KEY `giveaway_vendor_tier_price_histories_vendor_tier_id_fkey`;
ALTER TABLE `upfoll_vendor_tier_price_histories` DROP FOREIGN KEY `giveaway_vendor_tier_price_histories_changed_by_fkey`;

-- DropTable
DROP TABLE `upfoll_vendor_tier_price_histories`;
