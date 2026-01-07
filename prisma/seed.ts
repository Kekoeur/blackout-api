// apps/client-api/prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function generateFriendCode(username: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${username}#${code}`;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Créer un bar
  const bar = await prisma.bar.create({
    data: {
      name: 'Le Shooter Paradise',
      city: 'Paris',
      address: '123 Rue de la Soif',
      apiKey: 'test-api-key-123',
      qrCode: 'bar-paradise-qr',
    },
  });

  console.log('✅ Bar créé:', bar.name);

  // Créer des shooters
  const drinks = await Promise.all([
    prisma.drink.create({
      data: {
        name: 'B-52',
        type: 'SHOOTER',
        alcoholLevel: 40,
        ingredients: ['Kahlua', 'Baileys', 'Grand Marnier'],
        description: 'Un shooter en couches spectaculaire',
        imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b',
      },
    }),
    prisma.drink.create({
      data: {
        name: 'Tequila Sunrise Shot',
        type: 'SHOOTER',
        alcoholLevel: 35,
        ingredients: ['Tequila', 'Orange juice', 'Grenadine'],
        description: 'Version shooter du classique cocktail',
        imageUrl: 'https://images.unsplash.com/photo-1546171753-97d7676e4602',
      },
    }),
    prisma.drink.create({
      data: {
        name: 'Jägerbomb',
        type: 'SHOOTER',
        alcoholLevel: 30,
        ingredients: ['Jägermeister', 'Red Bull'],
        description: 'Le shooter énergisant par excellence',
        imageUrl: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a',
      },
    }),
    prisma.drink.create({
      data: {
        name: 'Kamikaze',
        type: 'SHOOTER',
        alcoholLevel: 40,
        ingredients: ['Vodka', 'Triple sec', 'Lime juice'],
        description: 'Un shooter acidulé et rafraîchissant',
        imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187',
      },
    }),
    prisma.drink.create({
      data: {
        name: 'Purple Rain',
        type: 'SHOOTER',
        alcoholLevel: 35,
        ingredients: ['Vodka', 'Blue Curaçao', 'Grenadine', 'Lemon juice'],
        description: 'Un shooter coloré et fruité',
        imageUrl: 'https://images.unsplash.com/photo-1536935338788-846bb9981813',
      },
    }),
  ]);

  for (const drink of drinks) {
    console.log('✅ Shooter créé:', drink.name);
  }

  // Ajouter les drinks au menu du bar
  for (const drink of drinks) {
    await prisma.menuDrink.create({
      data: {
        barId: bar.id,
        drinkId: drink.id,
        price: 5.5,
        available: true,
      },
    });
  }

  // Créer un user de test
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  // ⭐ Générer un friendCode unique
  let friendCode = generateFriendCode('testuser');
  let codeExists = await prisma.user.findUnique({
    where: { friendCode },
  });
  
  while (codeExists) {
    friendCode = generateFriendCode('testuser');
    codeExists = await prisma.user.findUnique({
      where: { friendCode },
    });
  }

  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      username: 'testuser',
      password: hashedPassword,
      friendCode, // ⭐ AJOUTER
    },
  });

  console.log('✅ User créé:', user.username);
  console.log('🎉 Seed terminé !');
  console.log('📧 Login: test@example.com');
  console.log('🔑 Password: password123');
  console.log('👥 Friend Code:', friendCode); // ⭐ AJOUTER
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });