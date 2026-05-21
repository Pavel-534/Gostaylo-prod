import {
  Wallet,
  CreditCard,
  QrCode,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Clock,
  AlertCircle,
} from 'lucide-react'

/** Конфиг методов оплаты для админ-списка платежей. */
export const PAYMENT_METHODS = {
  CRYPTO: { label: 'Crypto (USDT)', icon: Wallet, color: 'amber' },
  USDT_TRC20: { label: 'Crypto (USDT)', icon: Wallet, color: 'amber' },
  CARD: { label: 'Card (Visa/MC)', icon: CreditCard, color: 'blue' },
  CARD_INTL: { label: 'Card (Visa/MC)', icon: CreditCard, color: 'blue' },
  MIR: { label: 'МИР', icon: CreditCard, color: 'green' },
  CARD_RU: { label: 'МИР', icon: CreditCard, color: 'green' },
  THAI_QR: { label: 'Thai QR', icon: QrCode, color: 'purple' },
}

export const STATUS_CONFIG = {
  PENDING: { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  VERIFYING: { label: 'Проверка', color: 'bg-blue-100 text-blue-800', icon: Loader2 },
  CONFIRMED: { label: 'Подтверждён', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  COMPLETED: { label: 'Завершён', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  FAILED: { label: 'Ошибка', color: 'bg-red-100 text-red-800', icon: XCircle },
  UNDERPAID: { label: 'Недоплата', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
  INVALID_RECIPIENT: { label: 'Неверный получатель', color: 'bg-red-100 text-red-800', icon: XCircle },
  REFUNDED: { label: 'Возврат', color: 'bg-gray-100 text-gray-800', icon: RefreshCw },
}

export function isTestPaymentRow(payment) {
  if (!payment || typeof payment !== 'object') return false
  if (payment.isTestMode === true || payment.is_test_mode === true) return true
  const mode = String(
    payment?.metadata?.provider_payload?.mode ||
      payment?.provider_payload?.mode ||
      payment?.providerPayload?.mode ||
      '',
  )
    .toLowerCase()
    .trim()
  return mode.includes('mock')
}
