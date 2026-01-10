// apps/client-api/src/utils/geocoding.service.ts
import axios from 'axios';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export class GeocodingService {
  private static readonly NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
  
  static async geocodeAddress(
    address: string,
    city: string,
    country: string = 'France'
  ): Promise<GeocodeResult | null> {
    // ⭐ ESSAYER PLUSIEURS VARIANTES DE LA REQUÊTE
    const queries = [
      `${address}, ${city}, ${country}`,                    // Original
      `${address}, ${city}`,                                // Sans pays
      `${city}, ${country}`,                                // Seulement ville
      `${address.replace('Rue', 'rue')}, ${city}, ${country}`, // Minuscules
    ];

    for (const query of queries) {
      console.log(`🔍 Trying query: "${query}"`);
      
      try {
        const response = await axios.get(this.NOMINATIM_URL, {
          params: {
            q: query,
            format: 'json',
            limit: 5, // ⭐ Augmenter la limite
            addressdetails: 1,
            countrycodes: 'fr', // ⭐ Forcer la France
          },
          headers: {
            'User-Agent': 'BarDashboard/1.0',
          },
        });

        console.log(`📊 Results found: ${response.data.length}`);

        if (response.data && response.data.length > 0) {
          const result = response.data[0];
          
          console.log(`✅ Best match: ${result.display_name}`);
          
          return {
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
            displayName: result.display_name,
          };
        }
      } catch (error) {
        console.error('❌ Geocoding error for query:', query, error.message);
      }

      // Pause entre les tentatives
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.warn('❌ No geocoding result after all attempts');
    return null;
  }

  // Reste inchangé...
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}