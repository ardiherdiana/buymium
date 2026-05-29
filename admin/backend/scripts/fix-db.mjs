import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function run() {
  // 1. Remove FAILED migration entry
  await prisma.$executeRawUnsafe(
    "DELETE FROM _prisma_migrations WHERE migration_name = 'add_role_table' AND finished_at IS NULL"
  )
  console.log('✓ Removed FAILED migration entry')

  // helper: add column only if it doesn't exist
  async function addColumnIfMissing(table, column, definition) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      table, column
    )
    if (Number(rows[0].cnt) === 0) {
      await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
      console.log(`✓ Added column ${table}.${column}`)
    } else {
      console.log(`- Column ${table}.${column} already exists, skipping`)
    }
  }

  // 2. Add permissions column to roles (NULL first, update, then NOT NULL)
  await addColumnIfMissing('roles', 'permissions', 'LONGTEXT NULL')
  await prisma.$executeRawUnsafe(
    `UPDATE \`roles\` SET \`permissions\` = '["users:read","users:create","users:update","users:delete","roles:read","roles:update","orders:read","orders:update","orders:delete","products:read","products:create","products:update","products:delete","stats:read"]' WHERE \`name\` = 'superadmin' AND (\`permissions\` IS NULL OR \`permissions\` = '')`
  )
  await prisma.$executeRawUnsafe(
    `UPDATE \`roles\` SET \`permissions\` = '["users:read","orders:read","orders:update","products:read","products:create","products:update","products:delete","stats:read"]' WHERE \`name\` = 'admin' AND (\`permissions\` IS NULL OR \`permissions\` = '')`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE \`roles\` MODIFY COLUMN \`permissions\` LONGTEXT NOT NULL`
  )
  console.log('✓ Permissions column set and locked NOT NULL')

  // 4. Add google_id and avatar to users
  await addColumnIfMissing('users', 'google_id', 'VARCHAR(255) NULL')
  await addColumnIfMissing('users', 'avatar', 'VARCHAR(500) NULL')
  console.log('✓ Added google_id and avatar to users')

  // 5a. Create sale_lines table (Prisma model - different from legacy sales_line)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`sale_lines\` (
      \`id\`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`sale_id\`         BIGINT UNSIGNED NOT NULL,
      \`account_id\`      BIGINT UNSIGNED DEFAULT NULL,
      \`accsmarket_id\`   BIGINT UNSIGNED DEFAULT NULL,
      \`unit_sale_price\` DOUBLE          DEFAULT NULL,
      \`price\`           DOUBLE          NOT NULL DEFAULT 0,
      \`profit\`          DOUBLE          NOT NULL DEFAULT 0,
      \`created_at\`      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`idx_sale_id\`       (\`sale_id\`),
      INDEX \`idx_account_id\`    (\`account_id\`),
      INDEX \`idx_accsmarket_id\` (\`accsmarket_id\`),
      CONSTRAINT \`fk_sale_line_sale\`       FOREIGN KEY (\`sale_id\`)       REFERENCES \`sales\`      (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_sale_line_account\`    FOREIGN KEY (\`account_id\`)    REFERENCES \`accounts\`   (\`id\`) ON DELETE SET NULL,
      CONSTRAINT \`fk_sale_line_accsmarket\` FOREIGN KEY (\`accsmarket_id\`) REFERENCES \`accsmarkets\`(\`id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log('✓ Created table: sale_lines')

  // 5b. Mark add_management_tables as applied if not already tracked
  await prisma.$executeRawUnsafe(`
    INSERT IGNORE INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    VALUES (UUID(), 'manual', NOW(), 'add_management_tables', NULL, NULL, NOW(), 1)
  `)
  console.log('✓ Marked add_management_tables as applied')

  // 5. Create ecommerce + autoposting tables
  const tables = [
    `CREATE TABLE IF NOT EXISTS \`product_sections\` (
      \`id\`          VARCHAR(100) NOT NULL,
      \`title\`       VARCHAR(255) NOT NULL,
      \`subtitle\`    TEXT         NOT NULL,
      \`order_index\` INT          NOT NULL DEFAULT 0,
      \`created_at\`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`idx_order\` (\`order_index\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`products\` (
      \`id\`          INT           NOT NULL AUTO_INCREMENT,
      \`title\`       TEXT          NOT NULL,
      \`description\` TEXT          NOT NULL,
      \`in_stock\`    INT           NOT NULL DEFAULT 0,
      \`price\`       DOUBLE        NOT NULL DEFAULT 0,
      \`rating\`      DOUBLE        NOT NULL DEFAULT 0,
      \`is_verified\` TINYINT(1)    NOT NULL DEFAULT 0,
      \`tags\`        VARCHAR(1000) NOT NULL DEFAULT '[]',
      \`section_id\`  VARCHAR(100)  DEFAULT NULL,
      \`created_at\`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`idx_in_stock\`   (\`in_stock\`),
      INDEX \`idx_section_id\` (\`section_id\`),
      CONSTRAINT \`fk_product_section\` FOREIGN KEY (\`section_id\`) REFERENCES \`product_sections\` (\`id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`orders\` (
      \`id\`             INT          NOT NULL AUTO_INCREMENT,
      \`user_id\`        BIGINT UNSIGNED NOT NULL,
      \`product_id\`     INT          NOT NULL,
      \`quantity\`       INT          NOT NULL DEFAULT 1,
      \`payment_method\` VARCHAR(100) DEFAULT NULL,
      \`total_price\`    DOUBLE       NOT NULL,
      \`status\`         VARCHAR(50)  NOT NULL DEFAULT 'pending',
      \`snap_token\`     VARCHAR(500) DEFAULT NULL,
      \`snap_url\`       VARCHAR(500) DEFAULT NULL,
      \`midtrans_id\`    VARCHAR(255) DEFAULT NULL,
      \`created_at\`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`idx_user_id\`     (\`user_id\`),
      INDEX \`idx_product_id\`  (\`product_id\`),
      INDEX \`idx_status\`      (\`status\`),
      INDEX \`idx_midtrans_id\` (\`midtrans_id\`),
      CONSTRAINT \`fk_order_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`stocks\` (
      \`id\`              INT          NOT NULL AUTO_INCREMENT,
      \`product_id\`      INT          NOT NULL,
      \`email\`           VARCHAR(255) DEFAULT NULL,
      \`password_email\`  LONGTEXT     DEFAULT NULL,
      \`username\`        VARCHAR(255) NOT NULL,
      \`password\`        LONGTEXT     NOT NULL,
      \`two_factor_code\` LONGTEXT     DEFAULT NULL,
      \`order_id\`        INT          DEFAULT NULL,
      \`status\`          VARCHAR(50)  NOT NULL DEFAULT 'available',
      \`created_at\`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`idx_product_id\` (\`product_id\`),
      INDEX \`idx_status\`     (\`status\`),
      INDEX \`idx_order_id\`   (\`order_id\`),
      CONSTRAINT \`fk_stock_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_stock_order\`   FOREIGN KEY (\`order_id\`)   REFERENCES \`orders\`   (\`id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`channels\` (
      \`id\`                 INT          NOT NULL AUTO_INCREMENT,
      \`user_id\`            BIGINT UNSIGNED NOT NULL,
      \`username\`           VARCHAR(255) NOT NULL,
      \`type\`               VARCHAR(50)  DEFAULT NULL,
      \`profile_photo_path\` VARCHAR(500) DEFAULT NULL,
      \`social_bu_id\`       VARCHAR(255) DEFAULT NULL,
      \`created_at\`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`unique_social_bu_id\` (\`social_bu_id\`),
      INDEX \`idx_user_id\`      (\`user_id\`),
      INDEX \`idx_social_bu_id\` (\`social_bu_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`posts\` (
      \`id\`             INT          NOT NULL AUTO_INCREMENT,
      \`user_id\`        BIGINT UNSIGNED NOT NULL,
      \`channel_id\`     INT          NOT NULL,
      \`caption\`        TEXT         NOT NULL,
      \`source\`         VARCHAR(255) DEFAULT NULL,
      \`image_url\`      VARCHAR(500) DEFAULT NULL,
      \`scheduled_time\` DATETIME(3)  DEFAULT NULL,
      \`status\`         VARCHAR(50)  NOT NULL DEFAULT 'drafted',
      \`social_bu_id\`   VARCHAR(255) DEFAULT NULL,
      \`posted_at\`      DATETIME(3)  DEFAULT NULL,
      \`created_at\`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`unique_social_bu_id\` (\`social_bu_id\`),
      INDEX \`idx_user_id\`        (\`user_id\`),
      INDEX \`idx_channel_id\`     (\`channel_id\`),
      INDEX \`idx_status\`         (\`status\`),
      INDEX \`idx_scheduled_time\` (\`scheduled_time\`),
      INDEX \`idx_created_at\`     (\`created_at\`),
      CONSTRAINT \`fk_post_channel\` FOREIGN KEY (\`channel_id\`) REFERENCES \`channels\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`schedules\` (
      \`id\`         INT         NOT NULL AUTO_INCREMENT,
      \`user_id\`    BIGINT UNSIGNED NOT NULL,
      \`channel_id\` INT         NOT NULL,
      \`day\`        VARCHAR(20) NOT NULL,
      \`is_active\`  TINYINT(1)  NOT NULL DEFAULT 1,
      \`slots\`      LONGTEXT    NOT NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`id\`),
      INDEX \`idx_user_id\`    (\`user_id\`),
      INDEX \`idx_channel_id\` (\`channel_id\`),
      CONSTRAINT \`fk_schedule_channel\` FOREIGN KEY (\`channel_id\`) REFERENCES \`channels\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ]

  for (const sql of tables) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS `(\w+)`/)[1]
    await prisma.$executeRawUnsafe(sql)
    console.log(`✓ Created table: ${tableName}`)
  }

  // 6. Mark encrypt_stock_credentials as applied (stocks already created with LONGTEXT above)
  await prisma.$executeRawUnsafe(
    `INSERT IGNORE INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES (UUID(), 'manual', NOW(), 'encrypt_stock_credentials', NULL, NULL, NOW(), 1)`
  )
  console.log('✓ Marked encrypt_stock_credentials as applied')

  console.log('\nAll done!')
  await prisma.$disconnect()
}

run().catch(e => {
  console.error('Error:', e.message)
  prisma.$disconnect()
  process.exit(1)
})
