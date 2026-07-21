-- Duitku payment gateway integration removed.

ALTER TABLE `orders`
  DROP COLUMN `payment_method`,
  DROP COLUMN `payment_gateway_ref`,
  DROP COLUMN `payment_session_id`,
  DROP COLUMN `payment_url`;
