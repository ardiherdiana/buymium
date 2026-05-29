// TypeScript interfaces that mirror Prisma models and shared types

export interface JwtPayload {
  userId: number
  email: string
  roleName: string
  roleId: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  pages: number
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  meta: PaginationMeta
}
