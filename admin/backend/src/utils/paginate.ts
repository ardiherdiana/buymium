export interface PaginationParams {
  page?: number | string
  limit?: number | string
}

export interface PaginationResult {
  skip: number
  take: number
  page: number
  limit: number
}

export function getPagination(params: PaginationParams): PaginationResult {
  const page = Math.max(1, parseInt(String(params.page || 1)))
  const limit = Math.min(100, Math.max(1, parseInt(String(params.limit || 20))))
  return {
    skip: (page - 1) * limit,
    take: limit,
    page,
    limit,
  }
}

export function paginationMeta(total: number, page: number, limit: number) {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  }
}
