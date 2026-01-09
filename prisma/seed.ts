import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ===== CONFIG SÉCURISÉE =====
  const USER_EMAIL = 'christopher.gthrpro@gmail.com';
  const USER_USERNAME = 'Kekoeur';
  const USER_FRIEND_CODE = 'Kekoeur#1';

  const BAR_ADMIN_EMAIL = 'christopher.gthrpro@gmail.com';
  const BAR_ADMIN_NAME = 'Kekoeur';

  const RAW_PASSWORD =
    process.env.SEED_ADMIN_PASSWORD ??
    (() => {
      throw new Error('❌ SEED_ADMIN_PASSWORD manquant');
    })();

  const hashedPassword = await bcrypt.hash(RAW_PASSWORD, 12);

  // ===== USER APP MOBILE =====
  const user = await prisma.user.upsert({
    where: { email: USER_EMAIL },
    update: {},
    create: {
      email: USER_EMAIL,
      username: USER_USERNAME,
      password: hashedPassword,
      friendCode: USER_FRIEND_CODE,
    },
  });

  console.log('✅ User créé:', user.username);

  // ===== BAR SUPER ADMIN =====
  const barAdmin = await prisma.barUser.upsert({
    where: { email: BAR_ADMIN_EMAIL },
    update: {},
    create: {
      email: BAR_ADMIN_EMAIL,
      password: hashedPassword,
      name: BAR_ADMIN_NAME,
      isSuperAdmin: true,
    },
  });

  console.log('✅ Bar Super Admin créé:', barAdmin.email);

  console.log('🎉 Seed terminé avec succès');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
