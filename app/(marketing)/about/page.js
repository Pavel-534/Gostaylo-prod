import { getSiteDisplayName } from '@/lib/site-url'
import AboutContent from '@/components/about/AboutContent'

export const metadata = {
  title: `About | ${getSiteDisplayName()}`,
  description: `${getSiteDisplayName()} — платформа краткосрочной аренды жилья в России: бронирование у собственников и партнёров, прозрачные условия, защита платежа.`,
}

export default function AboutPage() {
  return <AboutContent />
}
