-- Drop unused columns from sources table
ALTER TABLE `sources`
  DROP COLUMN `prefix`,
  DROP COLUMN `image`,
  DROP COLUMN `color`;
