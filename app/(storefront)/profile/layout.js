import '@/lib/translations/register-profile-i18n-slice'
import { RouteI18nBootstrap } from '@/components/i18n/I18nSliceBootstrap'

export default function ProfileLayout({ children }) {
  return (
    <>
      <RouteI18nBootstrap preset="profile" />
      {children}
    </>
  )
}
