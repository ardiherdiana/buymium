import { z } from 'zod'

// ─── Products ─────────────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  // price arrives as a number or string (parseFloat is called in the route)
  price: z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d+)?$/, 'Price must be a non-negative number')]),
  sectionId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  imageUrl: z.string().optional().nullable(),
})

export const UpdateProductSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  price: z.union([
    z.number().nonnegative(),
    z.string().regex(/^\d+(\.\d+)?$/, 'Price must be a non-negative number'),
  ]).optional(),
  sectionId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  inStock: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
  isVerified: z.boolean().optional(),
  imageUrl: z.string().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
})

const ProductVariantSchema = z.object({
  name: z.string().min(1, 'Nama opsi wajib diisi'),
  price: z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d+)?$/, 'Price must be a non-negative number')]),
  isActive: z.boolean().optional(),
})

export const ReplaceProductVariantsSchema = z.object({
  variantLabel: z.string().min(1).max(100).nullable().optional(),
  variants: z.array(ProductVariantSchema).max(50, 'Maksimal 50 opsi variasi'),
})

// ─── Orders ───────────────────────────────────────────────────────────────────

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'awaiting_confirmation', 'paid', 'failed', 'cancelled'], {
    errorMap: () => ({ message: 'Invalid status value' }),
  }),
})

export const ConfirmPaymentSchema = z.object({
  adminNote: z.string().optional(),
})

export const RejectPaymentSchema = z.object({
  adminNote: z.string().min(1, 'Catatan alasan penolakan wajib diisi'),
})

export const CreateBankAccountSchema = z.object({
  bankName: z.string().min(1, 'Nama bank wajib diisi'),
  accountHolder: z.string().min(1, 'Nama pemilik wajib diisi'),
  accountNumber: z.string().min(1, 'Nomor rekening wajib diisi'),
  logo: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export const UpdateBankAccountSchema = z.object({
  bankName: z.string().min(1).optional(),
  accountHolder: z.string().min(1).optional(),
  accountNumber: z.string().min(1).optional(),
  logo: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
})

// ─── Stocks ───────────────────────────────────────────────────────────────────

const OptionalVariantId = z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional().nullable()

export const CreateStockSchema = z.object({
  productId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/, 'productId must be a positive integer')]),
  variantId: OptionalVariantId,
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  email: z.string().email().optional().nullable(),
  passwordEmail: z.string().optional().nullable(),
  twoFactorCode: z.string().optional().nullable(),
})

const BulkStockItemSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  email: z.string().optional(),
  password_email: z.string().optional(),
  two_factor_code: z.string().optional(),
})

export const BulkStockSchema = z.object({
  productId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/, 'productId must be a positive integer')]),
  variantId: OptionalVariantId,
  data: z.array(BulkStockItemSchema).min(1, 'data must be a non-empty array'),
})

export const UpdateStockSchema = z.object({
  email: z.string().email().nullable().optional(),
  passwordEmail: z.string().nullable().optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  twoFactorCode: z.string().nullable().optional(),
  status: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
})

// ─── Sections ─────────────────────────────────────────────────────────────────

export const CreateSectionSchema = z.object({
  id: z.string().min(1, 'id is required'),
  title: z.string().min(1, 'title is required'),
  subtitle: z.string().optional(),
  order: z.number().int().optional(),
})

export const UpdateSectionSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().optional(),
  order: z.number().int().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
})

// ─── Users ────────────────────────────────────────────────────────────────────

export const UpdateUserRoleSchema = z.object({
  roleId: z.literal(1).or(z.literal(2)),
})
