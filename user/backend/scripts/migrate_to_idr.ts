import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting migration: USD -> IDR...')
  
  const products = await prisma.product.findMany()
  console.log(`Found ${products.length} products to migrate.`)

  for (const product of products) {
    if (product.priceFrom < 5000) {
      const newPriceFrom = Math.round(product.priceFrom * 15000)
      const newPriceTo = Math.round(product.priceTo * 15000)
      
      await prisma.product.update({
        where: { id: product.id },
        data: {
          priceFrom: newPriceFrom,
          priceTo: newPriceTo
        }
      })
      console.log(`Updated product ${product.id}: ${product.priceFrom} -> ${newPriceFrom}`)
    } else {
      console.log(`Skipped product ${product.id}: Price already looks like IDR (${product.priceFrom})`)
    }
  }

  console.log('Migration completed successfully!')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
