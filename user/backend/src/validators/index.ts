import { z } from 'zod'


export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
})

export const OtpVerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
})

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
})

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100),
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(100),
})

export const GoogleAuthSchema = z.object({
  credential: z.string().min(1),
})


export const CreateOrderSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().optional().default(1),
  stockIds: z.array(z.number().int().positive()).optional(),
})

export const CartOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        stockIds: z.array(z.number().int().positive()).optional(),
      })
    )
    .min(1),
})


export const StockBulkItemSchema = z.object({
  email: z.string().optional(),
  password_email: z.string().optional(),
  username: z.string().min(1),
  password: z.string().min(1),
  two_factor_code: z.string().optional(),
})

export const StockBulkSchema = z.object({
  productId: z.number().int().positive(),
  data: z.array(StockBulkItemSchema).min(1),
})


export const CreateProductSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  inStock: z.number().int().min(0).optional(),
  price: z.number().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
  isVerified: z.boolean().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  sectionId: z.string().optional().nullable(),
})

export const UpdateProductSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  inStock: z.number().int().min(0).optional(),
  price: z.number().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
  isVerified: z.boolean().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  sectionId: z.string().optional().nullable(),
})


export const CreateSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  order: z.number().int().optional(),
})


export const UpdateRoleSchema = z.object({
  roleId: z.union([z.literal(1), z.literal(2)]),
})
