'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Calendar as CalendarIcon, Plus, Loader2, AlertCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format, differenceInDays, parseISO } from 'date-fns'
import {
  deleteListingCalendarBlock,
  fetchListingCalendarBlocks,
  postListingCalendarBlock,
} from '@/lib/api/partner-calendar-client'
import { cn } from '@/lib/utils'
import {
  WIZARD_MOBILE_FLAT_CARD_CLASS,
  WIZARD_MOBILE_FLAT_CARD_HEADER_CLASS,
  WIZARD_MOBILE_FLAT_CARD_CONTENT_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { PARTNER_FIELD_LABEL_CLASS } from '@/lib/ui/partner-section-rhythm'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { resolvePartnerDateFnsLocale } from '@/lib/ui/partner-date-fns-locale'
import { PartnerDateRangeFields } from '@/components/partner/PartnerDateRangeFields'
import { partitionPartnerListingBlocks } from '@/lib/calendar/block-source-display.js'

/**
 * Stage 200.118 Wave C — full getUIText i18n (ru/en/zh/th) for wizard block dates UI.
 */
export default function AvailabilityCalendar({
  listingId,
  syncErrors = [],
  embedInPartnerSection = false,
}) {
  const { language } = useI18n()
  const dateLocale = resolvePartnerDateFnsLocale(language)
  const t = useCallback((key) => getUIText(key, language), [language])
  const tr = useCallback(
    (key, vars) => {
      let s = getUIText(key, language)
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.split(`{{${k}}}`).join(String(v))
        }
      }
      return s
    },
    [language],
  )

  const [loading, setLoading] = useState(true)
  const [blocks, setBlocks] = useState([])
  const [blockedDates, setBlockedDates] = useState([])
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const [newBlock, setNewBlock] = useState({
    startDate: null,
    endDate: null,
    reason: '',
  })

  useEffect(() => {
    if (listingId) {
      loadBlocks()
    }
  }, [listingId])

  async function loadBlocks() {
    try {
      const { ok, blocks: rows, blockedDates: dates } = await fetchListingCalendarBlocks(listingId)
      if (ok) {
        setBlocks(rows)
        setBlockedDates(dates)
      }
    } catch (error) {
      console.error('Failed to load blocks:', error)
    } finally {
      setLoading(false)
    }
  }

  async function addBlock() {
    if (!newBlock.startDate || !newBlock.endDate) {
      toast.error(t('partnerCal_pickDate'))
      return
    }

    setAdding(true)
    try {
      const { ok, error } = await postListingCalendarBlock(listingId, {
        startDate: format(newBlock.startDate, 'yyyy-MM-dd'),
        endDate: format(newBlock.endDate, 'yyyy-MM-dd'),
        reason: newBlock.reason || t('partnerAvail_defaultReason'),
      })

      if (ok) {
        toast.success(t('partnerCal_toast_blockSuccess'))
        setNewBlock({ startDate: null, endDate: null, reason: '' })
        loadBlocks()
      } else {
        throw new Error(error || t('partnerAvail_genericError'))
      }
    } catch (error) {
      toast.error(error.message || t('partnerCal_toast_blockError'))
    } finally {
      setAdding(false)
    }
  }

  async function removeBlock(blockId) {
    setDeleting(blockId)
    try {
      const { ok, error } = await deleteListingCalendarBlock(listingId, blockId)

      if (ok) {
        toast.success(t('partnerCal_toast_unblockSuccess'))
        loadBlocks()
      } else {
        throw new Error(error || t('partnerAvail_genericError'))
      }
    } catch (error) {
      toast.error(error.message || t('partnerCal_toast_unblockError'))
    } finally {
      setDeleting(null)
    }
  }

  const { manual: manualBlocks, ical: icalBlocks } = partitionPartnerListingBlocks(blocks)
  const disabledDates = blockedDates.map((d) => parseISO(d))

  if (loading) {
    return (
      <Card className={WIZARD_MOBILE_FLAT_CARD_CLASS}>
        <CardContent className={cn('py-8', WIZARD_MOBILE_FLAT_CARD_CONTENT_CLASS)}>
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6" data-testid="availability-calendar">
      {syncErrors.length > 0 && (
        <Card
          className={cn(
            WIZARD_MOBILE_FLAT_CARD_CLASS,
            'sm:border-amber-200 sm:bg-amber-50',
          )}
        >
          <CardContent className={cn('py-4', WIZARD_MOBILE_FLAT_CARD_CONTENT_CLASS)}>
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">{t('partnerAvail_syncErrorTitle')}</p>
                <p className="mt-1 text-sm text-amber-700">{t('partnerAvail_syncErrorBody')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className={WIZARD_MOBILE_FLAT_CARD_CLASS}>
        <CardHeader className={cn('pb-3', WIZARD_MOBILE_FLAT_CARD_HEADER_CLASS)}>
          <CardTitle
            className={cn(
              'flex items-center gap-2',
              embedInPartnerSection ? PARTNER_FIELD_LABEL_CLASS : 'text-base',
            )}
          >
            <Plus className="h-4 w-4" />
            {t('partnerAvail_blockTitle')}
          </CardTitle>
          <CardDescription className={cn(embedInPartnerSection && 'text-xs leading-relaxed')}>
            {t('partnerAvail_blockDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className={WIZARD_MOBILE_FLAT_CARD_CONTENT_CLASS}>
          <div className="space-y-4">
            <PartnerDateRangeFields
              startDate={newBlock.startDate}
              endDate={newBlock.endDate}
              autoOpenEnd={false}
              onChange={({ startDate, endDate }) =>
                setNewBlock((prev) => ({ ...prev, startDate, endDate }))
              }
              startLabel={t('partnerCal_dateStart')}
              endLabel={t('partnerCal_dateEnd')}
              disablePast
              disabledDates={disabledDates}
              startTestId="availability-block-start-trigger"
              endTestId="availability-block-end-trigger"
            />

            <div className="space-y-2">
              <Label>{t('partnerAvail_reasonLabel')}</Label>
              <Input
                placeholder={t('partnerAvail_reasonPh')}
                value={newBlock.reason}
                onChange={(e) => setNewBlock((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </div>

            {newBlock.startDate && newBlock.endDate && (
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                <div className="text-sm text-slate-600">
                  {tr('partnerAvail_daysWillBlock', {
                    count: differenceInDays(newBlock.endDate, newBlock.startDate) + 1,
                  })}
                </div>
                <Button
                  onClick={addBlock}
                  disabled={adding}
                  className="min-h-[44px] bg-brand hover:bg-brand-hover"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      {t('partnerCal_blockSubmit')}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className={WIZARD_MOBILE_FLAT_CARD_CLASS}>
        <CardHeader className={cn('pb-3', WIZARD_MOBILE_FLAT_CARD_HEADER_CLASS)}>
          <CardTitle
            className={cn(embedInPartnerSection ? PARTNER_FIELD_LABEL_CLASS : 'text-base')}
          >
            {t('partnerAvail_manualTitle')}
          </CardTitle>
          <CardDescription className={cn(embedInPartnerSection && 'text-xs leading-relaxed')}>
            {t('partnerAvail_manualDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className={WIZARD_MOBILE_FLAT_CARD_CONTENT_CLASS}>
          {manualBlocks.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">{t('partnerAvail_manualEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {manualBlocks.map((block) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium">
                        {format(parseISO(block.start_date), 'd MMM', { locale: dateLocale })} —{' '}
                        {format(parseISO(block.end_date), 'd MMM yyyy', { locale: dateLocale })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {differenceInDays(parseISO(block.end_date), parseISO(block.start_date)) + 1}{' '}
                        {t('partnerAvail_daysShort')}
                      </Badge>
                    </div>
                    {block.reason && (
                      <p className="text-xs text-slate-500 mt-1 ml-6">{block.reason}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBlock(block.id)}
                    disabled={deleting === block.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    aria-label={t('partnerCal_unblockSubmit')}
                  >
                    {deleting === block.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {icalBlocks.length > 0 && (
        <Card className={WIZARD_MOBILE_FLAT_CARD_CLASS}>
          <CardHeader className={cn('pb-3', WIZARD_MOBILE_FLAT_CARD_HEADER_CLASS)}>
            <CardTitle
              className={cn(embedInPartnerSection ? PARTNER_FIELD_LABEL_CLASS : 'text-base')}
            >
              {t('partnerAvail_icalTitle')}
            </CardTitle>
            <CardDescription>{t('partnerAvail_icalDesc')}</CardDescription>
          </CardHeader>
          <CardContent className={WIZARD_MOBILE_FLAT_CARD_CONTENT_CLASS}>
            <div className="space-y-2">
              {icalBlocks.slice(0, 10).map((block) => (
                <div key={block.id} className="flex items-center p-3 bg-blue-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-900">
                        {format(parseISO(block.start_date), 'd MMM', { locale: dateLocale })} —{' '}
                        {format(parseISO(block.end_date), 'd MMM yyyy', { locale: dateLocale })}
                      </span>
                      <Badge className="bg-blue-100 text-blue-700 text-xs">
                        {t('partnerCal_chipIcal')}
                      </Badge>
                    </div>
                    {block.reason && (
                      <p className="text-xs text-blue-600 mt-1 ml-6">{block.reason}</p>
                    )}
                  </div>
                </div>
              ))}
              {icalBlocks.length > 10 && (
                <p className="text-xs text-slate-500 text-center">
                  {tr('partnerAvail_moreRecords', { count: icalBlocks.length - 10 })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
