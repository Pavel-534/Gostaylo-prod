/**
 * GoStayLo - Renter Portal Entry
 * Redirects to Dashboard
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function RenterPortal() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/renter/dashboard')
  }, [router])
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
    </div>
  )
}
