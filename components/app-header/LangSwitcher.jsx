'use client'

/**
 * LangSwitcher — SSOT language control for AppHeader, ChatTopBar, FooterSwitchers.
 *
 * Trigger: Globe (+ optional code) — never a tiny SVG flag in chrome.
 * Menu flags: emoji from SUPPORTED_UI_LANGUAGES (`lang.flag`) — same as locale-resolver SSOT.
 *
 * Stage 200.3 — unify header/footer; drop SVG Flag trigger.
 */

import { Globe, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/contexts/i18n-context'
import { supportedLanguages } from '@/lib/translations'
import { cn } from '@/lib/utils'

export function LangSwitcher({
  size = 'default',
  variant = 'header',
  testid = 'language-selector-trigger',
  className = '',
}) {
  const { language, setLanguage } = useI18n()
  const isFooter = variant === 'footer'
  const Chevron = isFooter ? ChevronUp : ChevronDown

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isFooter ? (
          <button
            type="button"
            data-testid={testid}
            aria-label="Language"
            className={cn(
              'flex min-h-[44px] items-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 transition-all hover:border-brand/40 hover:bg-slate-800 hover:text-white',
              className,
            )}
          >
            <Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{language}</span>
            <Chevron className="h-3 w-3 shrink-0 text-slate-500" />
          </button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'rounded-full border border-slate-200 p-0 hover:bg-slate-100',
              size === 'compact'
                ? 'h-11 w-11 min-h-[44px] min-w-[44px] sm:h-8 sm:w-8 sm:min-h-0 sm:min-w-0'
                : 'h-11 w-11 min-h-[44px] min-w-[44px] sm:h-9 sm:w-9 sm:min-h-0 sm:min-w-0',
              className,
            )}
            data-testid={testid}
            aria-label="Language"
          >
            <Globe className="h-4 w-4 text-slate-600" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isFooter ? 'start' : 'end'}
        side={isFooter ? 'top' : 'bottom'}
        className={cn(
          'z-[220] min-w-[160px]',
          isFooter && 'border-slate-700 bg-slate-900 text-slate-100',
        )}
      >
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            data-testid={`language-option-${lang.code}`}
            className={cn(
              'cursor-pointer gap-2',
              isFooter && 'focus:bg-slate-800 focus:text-white',
              language === lang.code &&
                (isFooter ? 'bg-brand/15 text-brand/70' : 'bg-brand/10 text-brand-hover'),
            )}
          >
            <span className="text-base leading-none" aria-hidden>
              {lang.flag || '🌐'}
            </span>
            <span className="text-sm font-medium">{lang.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LangSwitcher
