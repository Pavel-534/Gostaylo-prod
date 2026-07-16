import { MarketingAppShell } from '@/components/layout/MarketingAppShell'

/** Help, legal, about — minimal chrome (i18n/currency from root). */
export default function MarketingLayout({ children }) {
  return <MarketingAppShell>{children}</MarketingAppShell>
}
