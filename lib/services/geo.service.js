/**
 * GoStayLo - Geo Detection Service
 * Auto-detect user's country and preferred currency via IP
 * 
 * API: ip-api.com (free tier)
 */

// Country to currency mapping
const COUNTRY_CURRENCY_MAP = {
  // CIS & Russia
  RU: 'RUB', // Russia
  BY: 'RUB', // Belarus (often uses RUB)
  KZ: 'RUB', // Kazakhstan
  UA: 'USD', // Ukraine
  
  // Asia
  TH: 'THB', // Thailand
  CN: 'CNY', // China
  JP: 'JPY', // Japan
  KR: 'KRW', // South Korea
  IN: 'INR', // India
  SG: 'SGD', // Singapore
  MY: 'THB', // Malaysia (close to Thailand, use THB)
  VN: 'USD', // Vietnam
  ID: 'USD', // Indonesia
  PH: 'USD', // Philippines
  
  // Europe
  GB: 'GBP', // United Kingdom
  DE: 'EUR', // Germany
  FR: 'EUR', // France
  IT: 'EUR', // Italy
  ES: 'EUR', // Spain
  NL: 'EUR', // Netherlands
  BE: 'EUR', // Belgium
  AT: 'EUR', // Austria
  CH: 'EUR', // Switzerland (close enough)
  SE: 'EUR', // Sweden
  NO: 'EUR', // Norway
  DK: 'EUR', // Denmark
  FI: 'EUR', // Finland
  PL: 'EUR', // Poland
  CZ: 'EUR', // Czech Republic
  
  // Americas
  US: 'USD', // United States
  CA: 'USD', // Canada
  MX: 'USD', // Mexico
  BR: 'USD', // Brazil
  AR: 'USD', // Argentina
  
  // Oceania
  AU: 'AUD', // Australia
  NZ: 'AUD', // New Zealand
  
  // Middle East
  AE: 'USD', // UAE
  SA: 'USD', // Saudi Arabia
  IL: 'USD', // Israel
};

// Default currency for unknown countries
const DEFAULT_CURRENCY = 'USD';

// Cache for geo data (5 minutes)
const geoCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export class GeoService {
  
  /**
   * Detect user's location by IP address
   * @param {string} ip - IP address (optional, uses requester's IP if null)
   * @returns {Promise<object>} Geo detection result
   */
  static async detectLocation(ip = null) {
    const cacheKey = ip || 'self';
    
    // Check cache
    const cached = geoCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return { ...cached.data, cached: true };
    }

    try {
      const url = ip 
        ? `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,region,timezone,currency`
        : `http://ip-api.com/json/?fields=status,country,countryCode,city,region,timezone,currency`;

      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'success') {
        throw new Error('IP lookup failed');
      }

      const result = {
        success: true,
        country: data.country,
        countryCode: data.countryCode,
        city: data.city,
        region: data.region,
        timezone: data.timezone,
        apiCurrency: data.currency,
        recommendedCurrency: this.getCurrencyForCountry(data.countryCode),
        timestamp: Date.now()
      };

      // Update cache
      geoCache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      console.log(`[GEO] Detected: ${data.country} (${data.countryCode}) → ${result.recommendedCurrency}`);
      
      return result;

    } catch (error) {
      console.error('[GEO] Detection error:', error.message);
      
      return {
        success: false,
        error: error.message,
        recommendedCurrency: DEFAULT_CURRENCY,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get recommended currency for a country
   * @param {string} countryCode - ISO country code
   * @returns {string} Currency code
   */
  static getCurrencyForCountry(countryCode) {
    return COUNTRY_CURRENCY_MAP[countryCode?.toUpperCase()] || DEFAULT_CURRENCY;
  }

  /**
   * Detect user's currency from request headers
   * Falls back to IP detection if no locale header
   * @param {Request} request - Next.js request object
   * @returns {Promise<string>} Currency code
   */
  static async detectCurrencyFromRequest(request) {
    try {
      // 1. Check for explicit currency cookie/header
      const currencyHeader = request.headers.get('x-currency');
      if (currencyHeader && COUNTRY_CURRENCY_MAP[currencyHeader]) {
        return currencyHeader;
      }

      // 2. Try to get country from Vercel/Cloudflare headers
      const cfCountry = request.headers.get('cf-ipcountry');
      const vercelCountry = request.headers.get('x-vercel-ip-country');
      const country = cfCountry || vercelCountry;
      
      if (country) {
        return this.getCurrencyForCountry(country);
      }

      // 3. Try Accept-Language header
      const acceptLang = request.headers.get('accept-language');
      if (acceptLang) {
        const match = acceptLang.match(/^([a-z]{2})-([A-Z]{2})/);
        if (match && match[2]) {
          return this.getCurrencyForCountry(match[2]);
        }
      }

      // 4. Fall back to IP detection
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                 request.headers.get('x-real-ip');
      
      if (ip && !ip.startsWith('127.') && !ip.startsWith('10.')) {
        const geoResult = await this.detectLocation(ip);
        if (geoResult.success) {
          return geoResult.recommendedCurrency;
        }
      }

      return DEFAULT_CURRENCY;

    } catch (error) {
      console.error('[GEO] Request detection error:', error.message);
      return DEFAULT_CURRENCY;
    }
  }

  /**
   * Get timezone for a country
   * @param {string} countryCode - ISO country code
   * @returns {string} Timezone string
   */
  static getTimezoneForCountry(countryCode) {
    const COUNTRY_TIMEZONE = {
      TH: 'Asia/Bangkok',
      RU: 'Europe/Moscow',
      CN: 'Asia/Shanghai',
      US: 'America/New_York',
      GB: 'Europe/London',
      DE: 'Europe/Berlin',
      AU: 'Australia/Sydney',
      JP: 'Asia/Tokyo',
      KR: 'Asia/Seoul',
      SG: 'Asia/Singapore',
      IN: 'Asia/Kolkata'
    };
    
    return COUNTRY_TIMEZONE[countryCode?.toUpperCase()] || 'Asia/Bangkok';
  }

  /**
   * Get all supported countries with their currencies
   * @returns {object[]} List of country-currency mappings
   */
  static getSupportedCountries() {
    return Object.entries(COUNTRY_CURRENCY_MAP).map(([code, currency]) => ({
      countryCode: code,
      currency
    }));
  }
}

export default GeoService;
