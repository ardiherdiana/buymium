-- Expand credential fields to TEXT to accommodate AES-256-GCM encrypted values
-- Encrypted format: {24 hex iv}:{n hex ciphertext}:{32 hex tag}
ALTER TABLE `stocks`
  MODIFY COLUMN `password`       LONGTEXT NOT NULL,
  MODIFY COLUMN `password_email` LONGTEXT NULL,
  MODIFY COLUMN `two_factor_code` LONGTEXT NULL;
