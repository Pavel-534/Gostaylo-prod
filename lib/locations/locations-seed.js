/**
 * Стартовые локации для UI до ответа API (как у Airbnb: данные «вшиты», сеть подмешивает актуальное).
 */
import { PHUKET_DISTRICTS } from '@/lib/locations/city-district-map'

export function getStaticLocationsSeed() {
  const sortedDistricts = [...PHUKET_DISTRICTS].sort()
  return {
    cities: ['Other', 'Phuket'],
    districtsByCity: {
      Phuket: sortedDistricts,
      Other: [],
    },
    allDistricts: sortedDistricts,
  }
}
