/**
 * RLS Security Audit Script
 * Checks Row Level Security status on critical tables
 */

const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I'

const TABLES_TO_AUDIT = ['listings', 'bookings', 'profiles']

async function auditRLS() {
  console.log('🔒 Starting RLS Security Audit\n')
  console.log('=' .repeat(60))
  console.log('SUPABASE ROW LEVEL SECURITY (RLS) AUDIT')
  console.log('=' .repeat(60) + '\n')

  for (const table of TABLES_TO_AUDIT) {
    console.log(`📋 Table: ${table}`)
    console.log('-'.repeat(60))
    
    try {
      // Test 1: Service Role Access (should bypass RLS)
      const serviceResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?limit=1&select=count`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'count=exact'
          }
        }
      )
      
      const contentRange = serviceResponse.headers.get('content-range')
      const serviceWorks = serviceResponse.ok
      
      console.log(`   Service Role Access: ${serviceWorks ? '✅ BYPASSES RLS' : '❌ BLOCKED'}`)
      if (contentRange) {
        const count = contentRange.split('/')[1]
        console.log(`   Total Rows (Service): ${count}`)
      }
      
      // Test 2: Anonymous Access (should be blocked by RLS if enabled)
      const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k'
      
      const anonResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?limit=1`,
        {
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`
          }
        }
      )
      
      const anonData = await anonResponse.json()
      const anonBlocked = !anonResponse.ok || (Array.isArray(anonData) && anonData.length === 0)
      
      console.log(`   Anonymous Access: ${anonBlocked ? '✅ BLOCKED (RLS Active)' : '⚠️  ALLOWED (No RLS)'}`)
      
      // RLS Status determination
      if (serviceWorks && anonBlocked) {
        console.log(`   ✅ RLS Status: ENABLED & WORKING`)
      } else if (serviceWorks && !anonBlocked) {
        console.log(`   ⚠️  RLS Status: DISABLED or NO POLICIES`)
      } else {
        console.log(`   ❌ RLS Status: MISCONFIGURED`)
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`)
    }
    
    console.log('')
  }
  
  console.log('=' .repeat(60))
  console.log('RECOMMENDATIONS')
  console.log('=' .repeat(60) + '\n')
  
  console.log('✅ Service Role Key: Should ALWAYS bypass RLS')
  console.log('✅ Anonymous/User Access: Should be restricted by RLS policies')
  console.log('✅ Admin Users (86boa@mail.ru): Should have policies granting full access')
  console.log('✅ Partner Users: Should only see their own listings/bookings')
  console.log('✅ Renter Users: Should only see their own bookings/profile\n')
  
  console.log('📝 Current Implementation:')
  console.log('   - Application-level security in /api/v2/partner/bookings')
  console.log('   - Filtering by owner_id/partner_id in API routes')
  console.log('   - Service role used for admin operations\n')
  
  console.log('🔧 Next Steps:')
  console.log('   1. Enable RLS on all tables')
  console.log('   2. Create policies for SELECT/INSERT/UPDATE/DELETE')
  console.log('   3. Test with real user tokens')
  console.log('   4. Verify admin bypass works correctly\n')
}

auditRLS()
  .then(() => {
    console.log('✅ Audit complete')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Audit failed:', error)
    process.exit(1)
  })
