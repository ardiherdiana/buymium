-- Rename "giveaway sponsor" module to "upfoll" across the board — table rename
-- only, no column renames needed (no column names carried the old prefix), so
-- this is a pure RENAME TABLE that preserves data and foreign keys.

RENAME TABLE `giveaway_vendors` TO `upfoll_vendors`;
RENAME TABLE `giveaway_vendor_tiers` TO `upfoll_vendor_tiers`;
RENAME TABLE `giveaway_vendor_tier_price_histories` TO `upfoll_vendor_tier_price_histories`;
RENAME TABLE `giveaway_sponsor_orders` TO `upfoll_orders`;
RENAME TABLE `giveaway_sponsor_items` TO `upfoll_items`;
