import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...\n')

  // ── Roles (required FK for users) ────────────────────────────────────────────
  // Role model is owned by admin/backend — seed via raw SQL so we don't conflict.
  // display_name is NOT NULL in DB (Laravel migration), so we must provide it.
  await prisma.$executeRaw`
    INSERT INTO roles (id, name, display_name, description, permissions)
    VALUES
      (1, 'superadmin', 'Super Admin', 'Full system access', '[]'),
      (2, 'admin',      'Admin',       'Admin dashboard access', '[]'),
      (3, 'user',       'User',        'Regular user access', '[]')
    ON DUPLICATE KEY UPDATE name = VALUES(name), display_name = VALUES(display_name)
  `
  console.log('✓ Roles ensured')

  // ── Sample User ──────────────────────────────────────────────────────────────
  const userPassword = await bcrypt.hash('user123', 10)
  await prisma.user.upsert({
    where: { email: 'user@buymium.com' },
    update: {},
    create: {
      name: 'John Doe',
      email: 'user@buymium.com',
      password: userPassword,
      roleId: 3,
      avatar: 'https://i.pravatar.cc/150?img=3',
    },
  })
  console.log('✓ Sample user: user@buymium.com / user123')

  // ── Sections ─────────────────────────────────────────────────────────────────
  const sectionsData = [
    {
      id: 'email-verified',
      title: 'Akun IG Terverifikasi Email',
      subtitle: 'Akun Instagram verifikasi email tanpa nomor telepon. Siap guna dengan resiko ban rendah.',
      order: 1,
    },
    {
      id: 'aged-accounts',
      title: 'Akun IG Lama (Aged)',
      subtitle: 'Akun Instagram terdaftar 2019-2022 dengan riwayat panjang. Tingkat kepercayaan tinggi.',
      order: 2,
    },
    {
      id: 'pva-accounts',
      title: 'Akun IG Verifikasi Telepon',
      subtitle: 'Instagram accounts dengan verifikasi nomor telepon. Tingkat keamanan maksimal.',
      order: 3,
    },
    {
      id: 'with-followers',
      title: 'Akun IG Dengan Follower',
      subtitle: 'Instagram accounts siap pakai dengan basis pengikut yang sudah ada.',
      order: 4,
    },
  ]

  for (const section of sectionsData) {
    await prisma.productSection.upsert({
      where: { id: section.id },
      update: { title: section.title, subtitle: section.subtitle, order: section.order },
      create: section,
    })
  }
  console.log(`✓ ${sectionsData.length} sections upserted`)

  // ── Products ─────────────────────────────────────────────────────────────────
  // Products have no unique key besides auto-increment id.
  // Only insert if the section has no products yet to stay idempotent.
  const productsBySection: Record<string, Parameters<typeof prisma.product.create>[0]['data'][]> = {
    'email-verified': [
      {
        title: 'Akun IG | Verifikasi Email | Tanpa HP | Kosong | Register USA',
        description: 'Akun Instagram terverifikasi email. Profil kosong tanpa foto atau informasi. IP terdaftar dari USA. Siap untuk warming dan setup custom.',
        price: 92550,
        inStock: 1305,
        rating: 4.8,
        isVerified: true,
        tags: JSON.stringify(['email-verified', 'no-phone', 'USA', 'blank']),
        sectionId: 'email-verified',
      },
      {
        title: 'IG Accounts | Email verified | Male/Female | Avatar + Bio | Registered Turkey',
        description: 'Akun Instagram terverifikasi email. Profil lengkap dengan avatar dan bio. Jenis kelamin Male atau Female. IP terdaftar dari Turki.',
        price: 92850,
        inStock: 2872,
        rating: 4.7,
        isVerified: true,
        tags: JSON.stringify(['email-verified', 'male-female', 'Turkey', 'with-bio']),
        sectionId: 'email-verified',
      },
      {
        title: 'IG Accounts | Email Outlook | Avatar + Posts | Full Profile | Turkey',
        description: 'Akun Instagram terverifikasi email Outlook. Profil lengkap dengan avatar, bio, dan beberapa posts. Registered dari Turki.',
        price: 93150,
        inStock: 1292,
        rating: 4.6,
        isVerified: true,
        tags: JSON.stringify(['outlook', 'full-profile', 'Turkey', 'with-posts']),
        sectionId: 'email-verified',
      },
      {
        title: 'IG Accounts | Email verified | No phone | Empty | Registered Ukraine',
        description: 'Akun Instagram terverifikasi email tanpa telepon. Profil kosong. Registered dari Ukraina.',
        price: 78300,
        inStock: 150,
        rating: 4.5,
        isVerified: false,
        tags: JSON.stringify(['email-verified', 'no-phone', 'Ukraine']),
        sectionId: 'email-verified',
      },
      {
        title: 'IG Accounts | Email verified | No phone | Empty | Registered Russia',
        description: 'Akun Instagram terverifikasi email tanpa telepon. Profil kosong. Registered dari Russia.',
        price: 93600,
        inStock: 16165,
        rating: 4.4,
        isVerified: false,
        tags: JSON.stringify(['email-verified', 'no-phone', 'Russia']),
        sectionId: 'email-verified',
      },
    ],
    'aged-accounts': [
      {
        title: 'Akun Aged IG | Reg 2019 | Verifikasi Email | Avatar | 50–200 Follower',
        description: 'Akun Instagram lama terdaftar 2019. Terverifikasi email. Dilengkapi avatar dan 50-200 pengikut organik. Cocok untuk instant use.',
        price: 187500,
        inStock: 430,
        rating: 4.9,
        isVerified: true,
        tags: JSON.stringify(['aged', '2019', 'with-followers', 'email-verified']),
        sectionId: 'aged-accounts',
      },
      {
        title: 'IG Aged Accounts | 2020 Reg | Email Verified | Blank | US IP',
        description: 'Akun Instagram aged tahun 2020. Email verified. Profil blank tanpa posts atau followers. US IP. Ready untuk manual warming.',
        price: 133500,
        inStock: 890,
        rating: 4.7,
        isVerified: true,
        tags: JSON.stringify(['aged', '2020', 'USA', 'blank']),
        sectionId: 'aged-accounts',
      },
      {
        title: 'IG Aged Accounts | 2021–2022 Reg | PVA | Full Profile | EU IP',
        description: 'Akun Instagram aged 2021-2022. Terverifikasi telepon (PVA). Profil lengkap dengan bio dan avatar. EU IP (Germany, France, Netherlands).',
        price: 157500,
        inStock: 620,
        rating: 4.8,
        isVerified: true,
        tags: JSON.stringify(['aged', '2021', 'PVA', 'EU', 'full-profile']),
        sectionId: 'aged-accounts',
      },
    ],
    'pva-accounts': [
      {
        title: 'Akun PVA IG | Verifikasi Telepon | Nomor US | Kosong | Instan',
        description: 'Akun Instagram dengan verifikasi telepon real USA. Profil kosong. Pengiriman instant setelah pembayaran. Format: login:password:email:phone.',
        price: 52500,
        inStock: 3480,
        rating: 4.6,
        isVerified: true,
        tags: JSON.stringify(['PVA', 'US-numbers', 'instant-delivery']),
        sectionId: 'pva-accounts',
      },
      {
        title: 'IG PVA Accounts | Phone Verified | UK Numbers | Avatar | Email',
        description: 'Akun Instagram terverifikasi nomor UK. Dilengkapi avatar dan email terhubung. Format lengkap dengan semua credential.',
        price: 63000,
        inStock: 1240,
        rating: 4.5,
        isVerified: false,
        tags: JSON.stringify(['PVA', 'UK-numbers', 'with-avatar', 'email-included']),
        sectionId: 'pva-accounts',
      },
      {
        title: 'IG PVA Accounts | Phone Verified | Canada | Full Setup | Instant',
        description: 'Akun Instagram PVA dengan nomor Canada. Profil sudah disetup lengkap. Instant delivery. Trusted untuk automation.',
        price: 87000,
        inStock: 567,
        rating: 4.7,
        isVerified: true,
        tags: JSON.stringify(['PVA', 'Canada', 'full-setup', 'instant']),
        sectionId: 'pva-accounts',
      },
    ],
    'with-followers': [
      {
        title: 'Akun IG | 500–1K Follower | Email Verified | Avatar + Posts | Mixed',
        description: 'Akun Instagram dengan 500-1000 follower real. Email verified. Avatar dan minimal 5 posts. Follower dari berbagai negara. Siap pakai.',
        price: 300000,
        inStock: 215,
        rating: 4.9,
        isVerified: true,
        tags: JSON.stringify(['with-followers', '500-1k', 'email-verified', 'with-posts']),
        sectionId: 'with-followers',
      },
      {
        title: 'IG Accounts | 1K–5K Followers | PVA | Full Profile | Lifestyle',
        description: 'Akun Instagram dengan 1000-5000 followers. Phone verified. Profil full dengan bio, avatar, 10-30 posts. Niche: lifestyle content.',
        price: 622500,
        inStock: 78,
        rating: 4.8,
        isVerified: true,
        tags: JSON.stringify(['with-followers', '1k-5k', 'PVA', 'lifestyle']),
        sectionId: 'with-followers',
      },
      {
        title: 'IG Accounts | 5K–10K Followers | Aged 2021 | Business | US/EU',
        description: 'Akun Instagram dengan 5000-10000 followers. Aged tahun 2021. Business category enabled. IP dari US atau EU. Professional ready.',
        price: 1275000,
        inStock: 34,
        rating: 4.9,
        isVerified: true,
        tags: JSON.stringify(['with-followers', '5k-10k', 'aged', 'business']),
        sectionId: 'with-followers',
      },
    ],
  }

  let totalProductsSeeded = 0
  for (const [sectionId, products] of Object.entries(productsBySection)) {
    const existing = await prisma.product.count({ where: { sectionId } })
    if (existing > 0) {
      console.log(`  ↳ ${sectionId}: ${existing} products exist, skipping`)
      continue
    }
    const result = await prisma.product.createMany({ data: products })
    totalProductsSeeded += result.count
    console.log(`  ↳ ${sectionId}: ${result.count} products seeded`)
  }
  if (totalProductsSeeded > 0) {
    console.log(`✓ ${totalProductsSeeded} products seeded`)
  }

  // ── Stocks ───────────────────────────────────────────────────────────────────
  const firstNames = [
    'alex','ryan','kevin','jason','mike','sarah','emily','jessica','laura','anna',
    'david','chris','james','daniel','matthew','olivia','sophia','emma','mia','chloe',
    'noah','liam','ethan','lucas','mason','ava','isabella','zoe','lily','grace',
    'nathan','adam','tyler','brandon','justin','hannah','madison','ashley','brianna','samantha',
    'andrew','dylan','austin','zachary','jordan','taylor','morgan','riley','avery','peyton',
    'cameron','logan','hunter','carter','parker','skylar','quinn','brooke','haley','amber',
    'gabriel','sebastian','nicholas','benjamin','anthony','victoria','natalie','alexis','kayla','destiny',
    'caleb','jack','owen','henry','eli','scarlett','aria','luna','nora','ellie',
    'ian','evan','cole','blake','chase','aubrey','claire','stella','violet','penelope',
    'aiden','jacob','michael','william','oliver','charlotte','amelia','abigail','harper','evelyn',
  ]
  const lastNames = [
    'smith','jones','brown','taylor','wilson','moore','anderson','thomas','jackson','white',
    'harris','martin','garcia','martinez','robinson','clark','lewis','lee','walker','hall',
    'allen','young','hernandez','king','wright','lopez','hill','scott','green','adams',
    'baker','gonzalez','nelson','carter','mitchell','perez','roberts','turner','phillips','campbell',
    'parker','evans','edwards','collins','stewart','sanchez','morris','rogers','reed','cook',
    'morgan','bell','murphy','bailey','rivera','cooper','richardson','cox','howard','ward',
    'torres','peterson','gray','ramirez','james','watson','brooks','kelly','sanders','price',
    'bennett','wood','barnes','ross','henderson','coleman','jenkins','perry','powell','long',
    'patterson','hughes','flores','washington','butler','simmons','foster','gonzales','bryant','alexander',
  ]
  const emailProviders = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com', 'proton.me', 'live.com']
  const usedUsernames = new Set<string>()

  function makeUsername(): string {
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)]
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)]
    const num = () => String(Math.floor(Math.random() * 9999) + 1)
    const sep = ['', '_', '.'][Math.floor(Math.random() * 3)]
    const formats = [
      () => `${fn}${sep}${ln}`,
      () => `${fn}${sep}${ln}${num()}`,
      () => `${fn}${num()}`,
      () => `${fn}${sep}${ln.slice(0, 4)}${num()}`,
      () => `_${fn}${sep}${ln}_`,
      () => `${fn}.official`,
      () => `real${sep}${fn}${num()}`,
      () => `${fn}${sep}${ln}.id`,
      () => `${fn}${sep}${ln}.ig`,
      () => `the${sep}${fn}${sep}${ln}`,
      () => `${fn}${sep}${ln}._`,
      () => `${fn}_${num()}`,
      () => `${ln}${sep}${fn}${num()}`,
      () => `${fn}.${ln}${num()}`,
    ]
    let u = formats[Math.floor(Math.random() * formats.length)]()
    let tries = 0
    while (usedUsernames.has(u) && tries < 30) {
      u = `${u}${Math.floor(Math.random() * 99)}`
      tries++
    }
    usedUsernames.add(u)
    return u
  }

  const allProducts = await prisma.product.findMany()
  let totalStockSeeded = 0
  let totalSynced = 0

  for (const product of allProducts) {
    // Hapus semua stok available (stok sold dibiarkan — order history tetap aman)
    await prisma.stock.deleteMany({ where: { productId: product.id, status: 'available' } })

    // Buat 80–150 stok available baru dengan username realistis
    const count = Math.floor(Math.random() * 71) + 80
    const rows = []
    for (let i = 0; i < count; i++) {
      const username = makeUsername()
      const base = username.replace(/[^a-z0-9]/g, '') || 'user'
      const n = Math.floor(Math.random() * 99999)
      const provider = emailProviders[Math.floor(Math.random() * emailProviders.length)]
      rows.push({
        productId: product.id,
        email: `${base}${n}@${provider}`,
        passwordEmail: `Ep${n}!x`,
        username,
        password: `Pw${n}@Zx`,
        twoFactorCode: Math.random() > 0.4
          ? String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
          : null,
        status: 'available',
      })
    }
    await prisma.stock.createMany({ data: rows })
    totalStockSeeded += rows.length

    // Sinkronkan inStock = jumlah stok available aktual
    const availableCount = await prisma.stock.count({ where: { productId: product.id, status: 'available' } })
    await prisma.product.update({ where: { id: product.id }, data: { inStock: availableCount } })
    totalSynced++
  }

  console.log(`✓ ${totalStockSeeded} stocks seeded (80–150 per produk)`)
  console.log(`✓ inStock disinkronkan untuk ${totalSynced} produk`)

  console.log('\n✅ Seeding complete!\n')
  console.log('  User:  user@buymium.com / user123')
}

main()
  .catch(e => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
