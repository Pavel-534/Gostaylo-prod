'use client'

import { useState } from 'react'
import { Send, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { KycUploader } from '@/components/kyc-uploader'
import { LegalConsentCheckboxRow } from '@/components/legal/LegalConsentCheckboxRow'
import { PARTNER_APPLICATION_MIN_EXPERIENCE } from '@/lib/partner/listing-quality-gates.js'

export function PartnerApplicationModal({ isOpen, onClose, onSubmit, isSubmitting }) {
  const { language } = useI18n()
  const [formData, setFormData] = useState({
    phone: '',
    experience: '',
    socialLink: '',
    portfolio: '',
    verificationDocUrl: null,
  })
  const [partnerLegalConsent, setPartnerLegalConsent] = useState(false)

  const kycStrings = {
    label: getUIText('partnerKycLabel', language),
    requiredBadge: '*',
    uploading: getUIText('partnerKycUploading', language),
    uploaded: getUIText('partnerKycUploaded', language),
    remove: getUIText('partnerKycRemove', language),
    tapToUpload: getUIText('partnerKycTapToUpload', language),
    fileTypesHint: getUIText('partnerKycFileTypesHint', language),
    privacyHint: getUIText('partnerKycPrivacyHint', language),
    errorTooLarge: getUIText('partnerKycErrorTooLarge', language),
    errorUploadFailed: getUIText('partnerKycErrorUpload', language),
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const doc = String(formData.verificationDocUrl || '').trim()
    if (!doc) {
      toast.error(getUIText('partnerKycDocRequiredError', language))
      return
    }
    if (!partnerLegalConsent) {
      toast.error(getUIText('partnerTermsConsentRequired', language))
      return
    }
    const phoneDigits = String(formData.phone || '').replace(/\D/g, '')
    if (phoneDigits.length < 8) {
      toast.error(getUIText('partnerApplicationPhoneInvalid', language) || 'Укажите корректный телефон (мин. 8 цифр)')
      return
    }
    if (String(formData.experience || '').trim().length < PARTNER_APPLICATION_MIN_EXPERIENCE) {
      toast.error(
        getUIText('partnerApplicationExperienceTooShort', language) ||
          `Опишите опыт подробнее (минимум ${PARTNER_APPLICATION_MIN_EXPERIENCE} символов)`,
      )
      return
    }
    onSubmit({ ...formData, verificationDocUrl: doc })
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-4 pb-[max(0.75rem,var(--app-bottom-nav-height,0px))]"
      onClick={onClose}
    >
      <div
        className="my-2 max-h-[min(90vh,calc(100dvh-2rem-var(--app-bottom-nav-height,0px)))] w-full min-w-0 max-w-lg overflow-y-auto rounded-xl bg-white sm:my-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-900">{getUIText('partnerApplication', language)}</h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label={language === 'ru' ? 'Закрыть' : 'Close'}
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>

          <p className="text-slate-600 mb-6">{getUIText('partnerApplicationDesc', language)}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {getUIText('phoneNumber', language)} *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+66 XXX XXX XXX"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {getUIText('hostingExperience', language)} *
              </label>
              <textarea
                required
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                placeholder={getUIText('partnerAppExperiencePlaceholder', language)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {getUIText('partnerAppSocialLabel', language)}
              </label>
              <input
                type="text"
                value={formData.socialLink}
                onChange={(e) => setFormData({ ...formData, socialLink: e.target.value })}
                placeholder={getUIText('renterProfileTelegramPlaceholder', language)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {getUIText('partnerAppPortfolioLabel', language)}
              </label>
              <input
                type="url"
                value={formData.portfolio}
                onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
                placeholder="https://…"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand"
              />
            </div>

            <KycUploader
              value={formData.verificationDocUrl}
              onChange={(url) => setFormData((prev) => ({ ...prev, verificationDocUrl: url }))}
              disabled={isSubmitting}
              strings={kycStrings}
              onUploadError={(msg) => toast.error(msg)}
              onUploadSuccess={() => toast.success(getUIText('partnerKycUploadSuccess', language))}
            />

            <LegalConsentCheckboxRow
              variant="partner"
              language={language}
              checked={partnerLegalConsent}
              onCheckedChange={setPartnerLegalConsent}
              id="renter-partner-legal-consent"
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="min-h-11 flex-1"
                disabled={isSubmitting}
              >
                {getUIText('renterProfileCancel', language)}
              </Button>
              <Button
                type="submit"
                variant="brand"
                className="min-h-11 flex-1"
                disabled={
                  isSubmitting || !String(formData.verificationDocUrl || '').trim() || !partnerLegalConsent
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {getUIText('renterProfileSubmitting', language)}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {getUIText('submitApplication', language)}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
