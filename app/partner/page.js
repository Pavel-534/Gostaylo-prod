'use client'

import { redirect } from 'next/navigation'
import { useEffect } from 'react'

export default function PartnerPage() {
  useEffect(() => {
    redirect('/partner/dashboard')
  }, [])

  return null
}