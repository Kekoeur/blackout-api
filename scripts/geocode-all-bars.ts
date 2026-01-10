// scripts/geocode-all-bars.ts
import { PrismaClient } from '@prisma/client';
import { GeocodingService } from '../src/utils/geocoding.service';

const prisma = new PrismaClient();

async function geocodeAllBars() {
  console.log('🌍 Starting geocoding of all bars...');

  const bars = await prisma.bar.findMany({
    where: {
      OR: [
        { latitude: null },
        { longitude: null },
      ],
    },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
    },
  });

  console.log(`📍 Found ${bars.length} bars without coordinates`);

  for (const bar of bars) {
    console.log(`\n🔄 Geocoding: ${bar.name} (${bar.city})`);

    const result = await GeocodingService.geocodeAddress(
      bar.address,
      bar.city,
      'France'
    );

    if (result) {
      await prisma.bar.update({
        where: { id: bar.id },
        data: {
          latitude: result.latitude,
          longitude: result.longitude,
        },
      });

      console.log(`✅ ${bar.name}: ${result.latitude}, ${result.longitude}`);
    } else {
      console.log(`❌ ${bar.name}: Could not geocode`);
    }

    // Respecter le rate limit de Nominatim (1 req/sec)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n🎉 Geocoding complete!');
}

geocodeAllBars()
  .catch(console.error)
  .finally(() => prisma.$disconnect());