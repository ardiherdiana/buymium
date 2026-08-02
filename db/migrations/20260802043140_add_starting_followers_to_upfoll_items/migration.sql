-- Baseline follower count captured when an upfoll order item is created,
-- so progress/completion is judged against (baseline + package target)
-- instead of the flat package target.
ALTER TABLE `upfoll_items` ADD COLUMN `starting_followers` INT NULL AFTER `username`;
