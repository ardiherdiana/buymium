import { z } from 'zod'

// ─── Accounts ─────────────────────────────────────────────────────────────────
// Fields from AccountsController.store / .update

export const CreateAccountSchema = z.object({
  order_index: z.number().int().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable(),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  target_followers: z.number().int().nonnegative().optional().nullable(),
  current_followers: z.number().int().nonnegative().optional().nullable(),
  account_status: z.string().optional().nullable(),
  login_app: z.string().optional().nullable(),
  capital: z.number().optional().nullable(),
  phone_model: z.string().optional().nullable(),
  source_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
  is_sold: z.boolean().optional(),
})

export const UpdateAccountSchema = CreateAccountSchema.partial()

// ─── Account Sync ─────────────────────────────────────────────────────────────

export const SyncAccountSchema = z.object({
  source_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
})

// ─── Accsmarkets ──────────────────────────────────────────────────────────────
// Fields from AccsmarketsController.store / .update

export const CreateAccsmarketSchema = z.object({
  order_index: z.number().int().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable(),
  password_email: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  two_factor_auth: z.string().optional().nullable(),
  target_followers: z.number().int().nonnegative().optional().nullable(),
  account_status: z.string().optional().nullable(),
  capital: z.number().optional().nullable(),
  year: z.string().optional().nullable(),
  source_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
  is_sold: z.boolean().optional(),
})

export const UpdateAccsmarketSchema = CreateAccsmarketSchema.partial()

// ─── Customers ────────────────────────────────────────────────────────────────
// Fields from CustomersController.store / .update

export const CreateCustomerSchema = z.object({
  username_shopee: z.string({ required_error: 'username_shopee is required' }).min(1, 'username_shopee is required'),
  nomor_hp: z.string().optional().nullable(),
  source_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
})

export const UpdateCustomerSchema = z.object({
  username_shopee: z.string({ required_error: 'username_shopee is required' }).min(1, 'username_shopee is required'),
  nomor_hp: z.string().optional().nullable(),
  source_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
})

// ─── Sales ────────────────────────────────────────────────────────────────────
// Fields from SalesController.store (nested items array)

const SaleItemSchema = z.object({
  account_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
  accsmarket_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
  unit_sale_price: z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d+)?$/)]).optional(),
  profit: z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)]).optional(),
})

export const CreateSaleSchema = z.object({
  sales_number: z.string().min(1, 'sales_number is required'),
  customer_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/, 'customer_id must be a positive integer')]),
  total_sale_price: z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d+)?$/)]),
  total_profit: z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)]),
  is_shopee: z.boolean().optional(),
  source_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
  items: z.array(SaleItemSchema).optional(),
})

// ─── Expenses ─────────────────────────────────────────────────────────────────
// Fields from ExpensesController.store / .update

export const CreateExpenseSchema = z.object({
  amount: z.union([z.number().positive('Amount must be positive'), z.string().regex(/^\d+(\.\d+)?$/)]),
  expense_date: z.string().min(1, 'expense_date is required'),
  category_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  source_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
})

export const UpdateExpenseSchema = CreateExpenseSchema.partial().extend({
  amount: z.union([z.number().positive(), z.string().regex(/^\d+(\.\d+)?$/)]).optional(),
  expense_date: z.string().min(1).optional(),
  category_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
})

// ─── Sources ──────────────────────────────────────────────────────────────────
// Fields from SourcesController.store / .update
// Note: sources also accept a file upload via multer — body fields only

export const CreateSourceSchema = z.object({
  name: z.string().min(1, 'name is required'),
  spreadsheet_id: z.string().min(1, 'spreadsheet_id is required'),
  color: z.string().optional().nullable(),
  prefix: z.string().optional().nullable(),
  is_accsmarket: z.union([z.boolean(), z.string()]).optional(),
})

export const UpdateSourceSchema = z.object({
  name: z.string().min(1, 'name is required'),
  spreadsheet_id: z.string().min(1, 'spreadsheet_id is required'),
  index: z.union([z.number().int(), z.string().regex(/^\d+$/)]).optional().nullable(),
  color: z.string().optional().nullable(),
  prefix: z.string().optional().nullable(),
  is_accsmarket: z.union([z.boolean(), z.string()]).optional(),
})

// ─── Expense Categories ───────────────────────────────────────────────────────
// Fields from ExpenseCategoriesController.store / .update

export const CreateExpenseCategorySchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional().nullable(),
})

export const UpdateExpenseCategorySchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional().nullable(),
})
