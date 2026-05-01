import { getSiteDisplayName } from '@/lib/site-url'
import AboutContent from '@/components/about/AboutContent'

export const metadata = {
  title: `About | ${getSiteDisplayName()}`,
  description:
    'GoStaylo — premium global rental aggregator: villas, yachts, vehicles, and tours in Russia, Thailand, Bali and beyond.',
}

export default function AboutPage() {
  return <AboutContent />
}
