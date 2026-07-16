'use client'

/**
 * Root client shell — slim sync providers + lazy auth (session) / deferred modal + chrome (Stage 171.31 / 171.34).
 * Keeps storefront cold path out of partner/profile/chat i18n and auth modal graph.
 */

import dynamic from 'next/dynamic'
import { I18nProvider } from '@/contexts/i18n-context'
import { CurrencyProvider } from '@/contexts/currency-context'
import { GeoProvider } from '@/contexts/geo-context'
import { GlobalStyles } from '@/components/providers/GlobalStyles'
import { AppQueryProvider } from '@/components/providers/app-query-provider'

const AuthProviderLazy = dynamic(
  () => import('@/contexts/auth-context').then((mod) => ({ default: mod.AuthProvider })),
  { ssr: true },
)

const DeferredRootChrome = dynamic(
  () =>
    import('@/components/providers/DeferredRootChrome').then((mod) => ({
      default: mod.DeferredRootChrome,
    })),
  { ssr: false },
)

export function RootClientProviders({ children, initialIsRussia }) {
  return (
    <>
      <GlobalStyles />
      <I18nProvider>
        <CurrencyProvider>
          <GeoProvider initialIsRussia={initialIsRussia}>
            <AuthProviderLazy>
              {/*
                Stage 189.1 hotfix — partner/admin/chat use TanStack Query.
                Storefront also nests AppQueryProvider (guest cache); partner must
                not rely on that shell or `No QueryClient set` crashes /partner.
              */}
              <AppQueryProvider>
                {children}
                <DeferredRootChrome />
              </AppQueryProvider>
            </AuthProviderLazy>
          </GeoProvider>
        </CurrencyProvider>
      </I18nProvider>
    </>
  )
}
