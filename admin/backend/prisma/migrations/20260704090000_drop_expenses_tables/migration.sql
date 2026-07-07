-- DropForeignKey
ALTER TABLE `expenses` DROP FOREIGN KEY `expenses_category_id_fkey`;

-- DropForeignKey
ALTER TABLE `expenses` DROP FOREIGN KEY `expenses_source_id_fkey`;

-- DropTable
DROP TABLE `expenses`;

-- DropTable
DROP TABLE `expense_categories`;
