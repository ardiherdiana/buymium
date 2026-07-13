import db from '../config/database'

export interface TestimonialUpdateData {
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
