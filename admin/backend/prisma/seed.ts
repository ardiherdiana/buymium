import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database with roles and users...')

  try {
    // Define roles with their permissions
    const roles = [
      {
        id: 1,
        name: 'superadmin',
        displayName: 'Super Admin',
        description: 'Full system access - Can manage all users and change roles',
        permissions: JSON.stringify([
          'users:read',
          'users:create',
          'users:update',
          'users:delete',
          'roles:read',
          'roles:update',
          'orders:read',
          'orders:update',
          'orders:delete',
          'products:read',
          'products:create',
          'products:update',
          'products:delete',
          'stats:read',
        ]),
      },
      {
        id: 2,
        name: 'admin',
        displayName: 'Admin',
        description: 'Admin dashboard access - Can manage orders and products',
        permissions: JSON.stringify([
          'users:read',
          'orders:read',
          'orders:update',
          'products:read',
          'products:create',
          'products:update',
          'products:delete',
          'stats:read',
        ]),
      },
      {
        id: 3,
        name: 'user',
        displayName: 'User',
        description: 'Regular user access - Can only view own orders',
        permissions: JSON.stringify(['orders:read:own', 'products:read']),
      },
    ]

    // Insert roles using Prisma
    for (const role of roles) {
      await prisma.role.upsert({
        where: { id: role.id },
        update: {
          displayName: role.displayName,
          description: role.description,
          permissions: role.permissions,
        },
        create: role,
      })
      console.log(`✅ Role '${role.name}' created/updated`)
    }

    // Create admin test users (manual login)
    const adminUsers = [
      {
        name: 'Super Admin',
        email: 'superadmin@buymium.com',
        password: 'super123',
        roleId: 1,
      },
      {
        name: 'Admin User',
        email: 'admin@buymium.com',
        password: 'admin123',
        roleId: 2,
      },
    ]

    for (const userData of adminUsers) {
      try {
        // Hash password before storing
        const hashedPassword = await bcrypt.hash(userData.password, 10)
        await prisma.user.create({
          data: {
            ...userData,
            password: hashedPassword,
          },
        })
        console.log(`✅ Admin '${userData.email}' created (roleId: ${userData.roleId})`)
      } catch (e: any) {
        if (e.code === 'P2002') {
          // User already exists, update role and password
          const hashedPassword = await bcrypt.hash(userData.password, 10)
          await prisma.user.update({
            where: { email: userData.email },
            data: { roleId: userData.roleId, password: hashedPassword },
          })
          console.log(`📝 Admin '${userData.email}' already exists, role and password updated`)
        } else {
          throw e
        }
      }
    }

    // Get all existing Google users and set them to role user (roleId: 3)
    const googleUsersUpdate = await prisma.user.updateMany({
      where: {
        googleId: { not: null },
        roleId: { not: 3 },
      },
      data: { roleId: 3 },
    })
    if (googleUsersUpdate.count > 0) {
      console.log(`📱 Updated ${googleUsersUpdate.count} Google users to role 'user' (roleId: 3)`)
    }

    // Resolve the Super Admin we just created/updated — used as creator for management records
    const superAdmin = await prisma.user.findUnique({
      where: { email: 'superadmin@buymium.com' },
    })
    if (!superAdmin) {
      throw new Error('Super Admin user not found after seeding — cannot proceed with management data')
    }

    console.log(`\n🌐 Autoposting: channels will be synced from SocialBu — no seed channels created`)

    // Seed Management Module Data
    console.log('\n🗂️  Seeding management module data...')

    // Create Sources — spreadsheetId is NOT NULL in DB (Laravel migration), default to '' if no sheet linked
    const source1 = await prisma.source.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'Instagram Growth',
        index: 1,
        color: '#E4405F',
        prefix: 'IG',
        spreadsheetId: '',
      },
    })

    const source2 = await prisma.source.upsert({
      where: { id: 2 },
      update: {},
      create: {
        name: 'TikTok Growth',
        index: 2,
        color: '#000000',
        prefix: 'TT',
        spreadsheetId: '',
      },
    })

    console.log(`✅ Sources created (${source1.name}, ${source2.name})`)

    // Create Accounts — idempotent via upsert on unique username
    const account1 = await prisma.account.upsert({
      where: { username: 'growth_account_1' },
      update: {},
      create: {
        email: 'growth1@instagram.com',
        username: 'growth_account_1',
        password: 'hashedpass123',
        targetFollowers: 50000,
        currentFollowers: 15234,
        accountStatus: 'active',
        capital: 1000000,
        sourceId: source1.id,
        isSold: false,
      },
    })

    const account2 = await prisma.account.upsert({
      where: { username: 'growth_account_2' },
      update: {},
      create: {
        email: 'growth2@instagram.com',
        username: 'growth_account_2',
        password: 'hashedpass456',
        targetFollowers: 100000,
        currentFollowers: 45890,
        accountStatus: 'active',
        capital: 2000000,
        sourceId: source1.id,
        isSold: false,
      },
    })

    console.log(`✅ Accounts upserted (${account1.username}, ${account2.username})`)

    // Create Expense Categories
    const expenseCats = [
      { id: 1, name: 'Advertising' },
      { id: 2, name: 'Tools & Software' },
      { id: 3, name: 'Operations' },
    ]

    for (const cat of expenseCats) {
      await prisma.expenseCategory.upsert({
        where: { id: cat.id },
        update: { name: cat.name },
        create: cat,
      })
    }

    console.log(`✅ Expense categories created (${expenseCats.length})`)

    // Create Customers — no natural unique key, so guard by usernameSh lookup
    const customer1 = await prisma.customer.findFirst({ where: { usernameSh: 'shopee_customer_1' } })
      ?? await prisma.customer.create({
        data: {
          usernameSh: 'shopee_customer_1',
          nomorHp: '081234567890',
          sourceId: source1.id,
          createdBy: superAdmin.id,
        },
      })

    const customer2 = await prisma.customer.findFirst({ where: { usernameSh: 'shopee_customer_2' } })
      ?? await prisma.customer.create({
        data: {
          usernameSh: 'shopee_customer_2',
          nomorHp: '081298765432',
          sourceId: source2.id,
          createdBy: superAdmin.id,
        },
      })

    console.log(`✅ Customers upserted (${customer1.usernameSh}, ${customer2.usernameSh})`)

    // Create Sales — guard by salesNumber to stay idempotent
    const existingSale = await prisma.sale.findFirst({ where: { salesNumber: 'SALE-20260420-001' } })
    if (!existingSale) {
      await prisma.sale.create({
        data: {
          salesNumber: 'SALE-20260420-001',
          customerId: customer1.id,
          totalSalePrice: 5000000,
          totalProfit: 1500000,
          isShopee: true,
          sourceId: source1.id,
          saleLines: {
            create: [
              {
                accountId: account1.id,
                price: 5000000,
                profit: 1500000,
              },
            ],
          },
        },
      })
      console.log('✅ Sales data created')
    } else {
      console.log('📝 Sales data already exists, skipped')
    }

    // Create Expenses — guard by deterministic combo (category + amount + source) to stay idempotent
    const existingExpense = await prisma.expense.findFirst({
      where: { categoryId: expenseCats[0].id, amount: 250000, sourceId: source1.id },
    })
    if (!existingExpense) {
      await prisma.expense.create({
        data: {
          categoryId: expenseCats[0].id,
          amount: 250000,
          expenseDate: new Date(),
          sourceId: source1.id,
        },
      })
      console.log('✅ Expenses created')
    } else {
      console.log('📝 Sample expense already exists, skipped')
    }

    // Seed Testimonials — find or create sample products first
    console.log('\n⭐ Seeding testimonials...')

    // Get existing products (or skip gracefully if none exist yet)
    const products = await prisma.product.findMany({ take: 5, orderBy: { id: 'asc' } })

    if (products.length > 0) {
      const sampleTestimonials = [
        {
          customerName: 'Budi Santoso',
          message: 'Akun Instagram yang saya beli kualitasnya sangat bagus! Followers asli dan engagement tinggi. Proses pembelian juga cepat dan aman. Recommended banget!',
          rating: 5,
        },
        {
          customerName: 'Siti Rahayu',
          message: 'Sudah beli 3 kali di sini, selalu puas. Akun TikTok yang didapat sesuai deskripsi, niche sudah jelas dan siap untuk promosi. Pelayanan admin responsif.',
          rating: 5,
        },
        {
          customerName: 'Andi Wijaya',
          message: 'Awalnya ragu, tapi ternyata legit banget. Akun langsung bisa diakses setelah konfirmasi pembayaran. Harga juga terjangkau untuk kualitas segini.',
          rating: 4,
        },
        {
          customerName: 'Dewi Lestari',
          message: 'Beli akun YouTube niche gaming. Sudah seminggu dipakai, tidak ada masalah sama sekali. Monetisasi sudah aktif dan siap digunakan. Sangat puas!',
          rating: 5,
        },
        {
          customerName: 'Rizki Pratama',
          message: 'Transaksi berjalan lancar, admin ramah dan cepat respon. Akun yang diterima sudah verified dan niche-nya relevan dengan bisnis saya. Akan beli lagi!',
          rating: 5,
        },
        {
          customerName: 'Fitri Handayani',
          message: 'Pelayanan profesional, akun asli dan berkualitas. Setelah beli langsung saya ganti password dan semua berjalan normal. Harga worth it banget!',
          rating: 4,
        },
        {
          customerName: 'Dimas Kurniawan',
          message: 'Beli akun Instagram niche kuliner buat jualan online. Followers aktif dan engagement rate bagus. Sudah dapat beberapa orderan dari sana. Mantap!',
          rating: 5,
        },
        {
          customerName: 'Nadia Permata',
          message: 'Proses cepat dan mudah. Upload bukti transfer langsung diproses dalam hitungan menit. Akun yang diterima sesuai ekspektasi. Highly recommended!',
          rating: 5,
        },
      ]

      let testimonialsCreated = 0
      for (let i = 0; i < sampleTestimonials.length; i++) {
        const t = sampleTestimonials[i]
        const product = products[i % products.length]

        const existing = await prisma.testimonial.findFirst({
          where: { customerName: t.customerName, productId: product.id },
        })

        if (!existing) {
          await prisma.testimonial.create({
            data: {
              productId: product.id,
              createdById: superAdmin.id,
              customerName: t.customerName,
              message: t.message,
              rating: t.rating,
              isPublished: true,
            },
          })
          testimonialsCreated++
        }
      }

      if (testimonialsCreated > 0) {
        console.log(`✅ ${testimonialsCreated} testimonials created`)
      } else {
        console.log('📝 Testimonials already exist, skipped')
      }
    } else {
      console.log('ℹ️  No products found — testimonials skipped (run after adding products)')
    }

    console.log('\n✨ Seeding complete!')
    console.log('\n📋 Configuration:')
    console.log('   ✅ Google login users → role "user" (roleId: 3)')
    console.log('   ✅ Manual login admins → role "admin" or "superadmin"')
    console.log('   ✅ Management module seeded with sources, accounts, customers, sales')
    console.log('\n📊 Management Data:')
    console.log('   Sources: 2 (Instagram Growth, TikTok Growth)')
    console.log('   Accounts: 2 (growth_account_1, growth_account_2)')
    console.log('   Customers: 2')
    console.log('   Sales: 1')
  } catch (e) {
    console.error('❌ Error during seeding:', e)
    throw e
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
