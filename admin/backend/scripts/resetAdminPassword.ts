import './../src/config/env'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  const password = process.argv[3]

  if (!email || !password) {
    console.error('Usage: tsx scripts/resetAdminPassword.ts <email> <newPassword>')
    process.exit(1)
  }

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.update({
    where: { email },
    data: { password: hashed },
    select: { id: true, email: true, role: { select: { name: true } } },
  })

  console.log(`Password reset for ${user.email} (role: ${user.role.name})`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
