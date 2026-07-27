import db from '../config/database'

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function generateUniqueSlug(title: string, excludeId?: number): Promise<string> {
  const base = slugify(title) || 'produk'
  let slug = base
  let suffix = 2
  while (
    await db.product.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
  ) {
    slug = `${base}-${suffix}`
    suffix += 1
  }
  return slug
}
