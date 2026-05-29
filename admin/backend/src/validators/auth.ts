import { z } from 'zod'

// ─── Auth ────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password minimal 8 karakter')
    .max(128, 'Password terlalu panjang'),
})

// ─── Roles ────────────────────────────────────────────────────────────────────

export const UpdateUserRoleByNameSchema = z.object({
  role: z.string({ required_error: 'Role name is required' }).min(1, 'Role name is required'),
})
