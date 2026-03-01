// Test the pricing calculation logic directly
// This tests the calculateBookingPriceSync method

class PricingServiceTest {
  static calculateDailyPrice(basePrice, dateStr, seasonalPricing) {
    let dailyPrice = basePrice;
    let seasonLabel = 'Base';
    
    if (seasonalPricing && seasonalPricing.length > 0) {
      for (const season of seasonalPricing) {
        const seasonStart = season.startDate;
        const seasonEnd = season.endDate;
        
        if (dateStr >= seasonStart && dateStr <= seasonEnd) {
          const multiplier = parseFloat(season.priceMultiplier) || 1.0;
          dailyPrice = Math.round(basePrice * multiplier);
          seasonLabel = season.name || 'Season';
          break;
        }
      }
    }
    
    return { dailyPrice, seasonLabel };
  }
  
  static calculateBookingPriceSync(basePrice, checkIn, checkOut, seasonalPricing = []) {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const nights = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0 || isNaN(nights)) {
      return { error: 'Invalid date range', nights: 0, totalPrice: 0 };
    }
    
    let totalPrice = 0;
    const priceBreakdown = [];
    const seasonSummary = {};
    
    for (let i = 0; i < nights; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      const { dailyPrice, seasonLabel } = this.calculateDailyPrice(basePrice, dateStr, seasonalPricing);
      
      totalPrice += dailyPrice;
      priceBreakdown.push({ date: dateStr, price: dailyPrice, season: seasonLabel });
      
      if (!seasonSummary[seasonLabel]) {
        seasonSummary[seasonLabel] = { nights: 0, subtotal: 0, dailyRate: dailyPrice };
      }
      seasonSummary[seasonLabel].nights++;
      seasonSummary[seasonLabel].subtotal += dailyPrice;
    }
    
    return {
      nights,
      totalPrice,
      basePrice,
      averageNightlyRate: Math.round(totalPrice / nights),
      priceBreakdown,
      seasonSummary
    };
  }
}

// Run tests
console.log('\n=== PRICING SERVICE TESTS ===\n');

// Test 1: Base price only (no seasonal)
console.log('TEST 1: Base price calculation (no seasonal pricing)');
const test1 = PricingServiceTest.calculateBookingPriceSync(35000, '2026-03-15', '2026-03-20', []);
console.log(`  Nights: ${test1.nights}`);
console.log(`  Total: ฿${test1.totalPrice.toLocaleString()}`);
console.log(`  Expected: 5 nights × ฿35,000 = ฿175,000`);
console.log(`  Result: ${test1.totalPrice === 175000 ? '✅ PASS' : '❌ FAIL'}`);

// Test 2: With seasonal pricing spanning entire booking
console.log('\nTEST 2: High season (entire booking)');
const seasonalPricing1 = [
  { id: 's1', name: 'High Season', startDate: '2026-03-01', endDate: '2026-03-31', priceMultiplier: 1.3 }
];
const test2 = PricingServiceTest.calculateBookingPriceSync(35000, '2026-03-15', '2026-03-20', seasonalPricing1);
console.log(`  Nights: ${test2.nights}`);
console.log(`  Total: ฿${test2.totalPrice.toLocaleString()}`);
console.log(`  Expected: 5 nights × ฿45,500 (35000 × 1.3) = ฿227,500`);
console.log(`  Season Summary:`, JSON.stringify(test2.seasonSummary));
console.log(`  Result: ${test2.totalPrice === 227500 ? '✅ PASS' : '❌ FAIL'}`);

// Test 3: Mixed seasons
console.log('\nTEST 3: Mixed seasons (High + Low)');
const seasonalPricing2 = [
  { id: 's1', name: 'High Season', startDate: '2026-03-01', endDate: '2026-03-17', priceMultiplier: 1.3 },
  { id: 's2', name: 'Low Season', startDate: '2026-03-18', endDate: '2026-03-31', priceMultiplier: 0.8 }
];
const test3 = PricingServiceTest.calculateBookingPriceSync(35000, '2026-03-15', '2026-03-20', seasonalPricing2);
console.log(`  Nights: ${test3.nights}`);
console.log(`  Price Breakdown:`);
test3.priceBreakdown.forEach(d => console.log(`    ${d.date}: ฿${d.price.toLocaleString()} (${d.season})`));
console.log(`  Season Summary:`, JSON.stringify(test3.seasonSummary));
console.log(`  Total: ฿${test3.totalPrice.toLocaleString()}`);
// Expected: 3 nights High (45500) + 2 nights Low (28000) = 136500 + 56000 = 192500
const expectedTest3 = (3 * 45500) + (2 * 28000);
console.log(`  Expected: 3 × ฿45,500 + 2 × ฿28,000 = ฿${expectedTest3.toLocaleString()}`);
console.log(`  Result: ${test3.totalPrice === expectedTest3 ? '✅ PASS' : '❌ FAIL'}`);

// Test 4: Invalid date range
console.log('\nTEST 4: Invalid date range');
const test4 = PricingServiceTest.calculateBookingPriceSync(35000, '2026-03-20', '2026-03-15', []);
console.log(`  Result: ${test4.error ? '✅ PASS (error caught)' : '❌ FAIL'}`);
console.log(`  Error: ${test4.error}`);

console.log('\n=== ALL TESTS COMPLETE ===\n');
