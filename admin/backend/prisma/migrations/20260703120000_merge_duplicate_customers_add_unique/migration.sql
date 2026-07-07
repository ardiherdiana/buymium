-- Merge customers that are duplicates of each other by username_shopee, case-insensitively
-- (e.g. id 127 "murahstor3" and id 737 "Murahstor3" are the same Shopee account).
-- Canonical customer = the one with the lowest id in each case-insensitive group.

CREATE TEMPORARY TABLE `_customer_canonical` AS
SELECT LOWER(`username_shopee`) AS `uname_lower`, MIN(`id`) AS `canonical_id`
FROM `customers`
WHERE `username_shopee` IS NOT NULL
GROUP BY LOWER(`username_shopee`);

-- Re-point sales from the duplicate customer rows to the canonical one
UPDATE `sales` s
JOIN `customers` c ON s.`customer_id` = c.`id`
JOIN `_customer_canonical` cc ON LOWER(c.`username_shopee`) = cc.`uname_lower`
SET s.`customer_id` = cc.`canonical_id`
WHERE c.`id` <> cc.`canonical_id`;

-- Drop the now-redundant duplicate customer rows
DELETE c FROM `customers` c
JOIN `_customer_canonical` cc ON LOWER(c.`username_shopee`) = cc.`uname_lower`
WHERE c.`id` <> cc.`canonical_id`;

DROP TEMPORARY TABLE `_customer_canonical`;

-- Normalize all remaining usernames to lowercase
UPDATE `customers` SET `username_shopee` = LOWER(`username_shopee`) WHERE `username_shopee` IS NOT NULL;

-- Enforce uniqueness going forward (NULL stays allowed multiple times, for WA-only customers)
ALTER TABLE `customers` ADD UNIQUE INDEX `customers_username_shopee_key` (`username_shopee`);
