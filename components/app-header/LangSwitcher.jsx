'use client'

/**
 * LangSwitcher — единый компонент переключения языка (RU/EN/ZH/TH).
 * Используется в AppHeader и FooterSwitchers (SSOT).
 */

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Flag } from '@/components/flags'
import { useI18n } from '@/contexts/i18n-context'
import { supportedLanguages } from '@/lib/translations'
import { cn } from '@/lib/utils'

function renderFlag(code) {
  const c = (code || '').toLowerCase()
  if (c === 'ru') return <Flag code="ru" title="RU" />
  if (c === 'en') return <Flag code="gb" title="GB" />
  if (c === 'zh') return <Flag code="cn" title="CN" />
  if (c === 'th') return <Flag code="th" title="TH" />
  return <Flag code="eu" title={c.toUpperCase()} />
}

export function LangSwitcher({ size = 'default', testid = 'language-selector-trigger' }) {
  const { language, setLanguage } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'p-0 rounded-full hover:bg-slate-100',
            size === 'compact' ? 'h-8 w-8' : 'h-8 w-8 sm:h-9 sm:w-9',
          )}
          data-testid={testid}
          aria-label="Language"
        >
          {renderFlag(language)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[220] min-w-[140px]">
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            data-testid={`language-option-${lang.code}`}
            className={cn(
              'cursor-pointer',
              language === lang.code && 'bg-brand/10 text-brand-hover',
            )}
          >
            <span className="mr-2">{renderFlag(lang.code)}</span>
            <span className="text-sm">{lang.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LangSwitcher
