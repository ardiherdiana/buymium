import db from '../config/database'

export interface TestimonialCreateData {
  productId: number
  createdById: number
  customerName: string
  message: string
  rating: number
  avatar?: string
  isPublished?: boolean
}

export interface TestimonialUpdateData {
  productId?: number
  customerName?: string
  message?: string
  rating?: number
  avatar?: string
  isPublished?: boolean
}

export class TestimonialService {
  static async getAll(productId?: number) {
    return db.testimonial.findMany({
      where: productId ? { productId } : undefined,
      include: {
        product: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async create(data: TestimonialCreateData) {
    return db.testimonial.create({
      data: {
        productId: data.productId,
        createdById: data.createdById,
        customerName: data.customerName,
        message: data.message,
        rating: data.rating ?? 5,
        avatar: data.avatar ?? null,
        isPublished: data.isPublished ?? true,
      },
      include: {
        product: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })
  }

  static async update(id: number, data: TestimonialUpdateData) {
    return db.testimonial.update({
      where: { id },
      data,
      include: {
        product: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })
  }

  static async remove(id: number) {
    return db.testimonial.delete({ where: { id } })
  }
}
