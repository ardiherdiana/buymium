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
  source_sheet_name: z.string().optional().nullable(),
  source_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
  is_sold: z.boolean().optional(),
})

export const UpdateAccountSchema = CreateAccountSchema.partial()

// ─── Account Sync ─────────────────────────────────────────────────────────────

export const SyncAccountSchema = z.object({
  source_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
})

// ─── Sources ──────────────────────────────────────────────────────────────────
// Fields from SourcesController.store / .update

export const CreateSourceSchema = z.object({
  name: z.string().min(1, 'name is required'),
  spreadsheet_id: z.string().min(1, 'spreadsheet_id is required'),
})

export const UpdateSourceSchema = CreateSourceSchema

// ─── Customers ────────────────────────────────────────────────────────────────
// Fields from CustomersController.store / .update

export const CreateCustomerSchema = z.object({
  username_shopee: z.string().min(1).optional().nullable(),
  nomor_hp: z.string().min(1).optional().nullable(),
  source_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
}).refine((data) => !!data.username_shopee?.trim() || !!data.nomor_hp?.trim(), {
  message: 'username_shopee atau nomor_hp wajib diisi salah satu',
})

export const UpdateCustomerSchema = z.object({
  username_shopee: z.string().min(1).optional().nullable(),
  nomor_hp: z.string().min(1).optional().nullable(),
  source_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
}).refine((data) => !!data.username_shopee?.trim() || !!data.nomor_hp?.trim(), {
  message: 'username_shopee atau nomor_hp wajib diisi salah satu',
})

// ─── Sales ────────────────────────────────────────────────────────────────────
// Fields from SalesController.store (nested items array)

const SaleItemSchema = z.object({
  account_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable(),
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

// ─── Upfoll Vendors ───────────────────────────────────────────────────────────
// Fields from UpfollVendorsController.store / .update

export const CreateUpfollVendorSchema = z.object({
  name: z.string().min(1, 'name is required'),
  is_active: z.boolean().optional(),
})

export const UpdateUpfollVendorSchema = CreateUpfollVendorSchema.partial()

// ─── Upfoll Vendor Tiers ──────────────────────────────────────────────────────
// Fields from UpfollVendorsController.storeTier / .updateTier — each vendor
// defines its own tiers (target-follower package + price it charges).

export const CreateUpfollVendorTierSchema = z.object({
  name: z.string().min(1, 'name is required'),
  target_followers: z.number().int().positive('target_followers must be a positive integer'),
  price: z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d+)?$/)]),
})

export const UpdateUpfollVendorTierSchema = CreateUpfollVendorTierSchema.partial()

// ─── Upfoll Orders ────────────────────────────────────────────────────────────
// Fields from UpfollOrdersController.store (nested items array)

const UpfollOrderItemSchema = z.object({
  username: z.string().min(1, 'username is required'),
  vendor_tier_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
})

export const CreateUpfollOrderSchema = z.object({
  customer_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/, 'customer_id must be a positive integer')]),
  total_sale_price: z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d+)?$/)]),
  is_shopee: z.boolean().optional(),
  shopee_order_number: z.string().optional().nullable(),
  items: z.array(UpfollOrderItemSchema).min(1, 'items must have at least one entry'),
})

