/**
 * Push / Telegram copy by listing category (PR-#2).
 * Uses same buckets as lib/escrow-thaw-rules.js (housing / transport / service).
 */

import { getEscrowThawBucketFromCategorySlug } from '@/lib/escrow-thaw-rules';

/**
 * @param {string | null | undefined} categorySlug
 * @param {'ru' | 'en'} lang
 */
export function getCheckInReminderTelegramCopy(categorySlug, lang = 'ru') {
  const bucket = getEscrowThawBucketFromCategorySlug(categorySlug);
  if (lang === 'en') {
    if (bucket === 'transport') {
      return {
        title: 'Handover / rental start',
        lead: 'Today is the start of your rental period.',
        action: 'Confirm pickup or handover in the app when you meet the host.',
      };
    }
    if (bucket === 'service') {
      return {
        title: 'Your service starts today',
        lead: 'Today is the day of your booking.',
        action: 'Confirm attendance or arrival in the app when the service begins.',
      };
    }
    return {
      title: 'Check-in',
      lead: 'Today is your check-in day.',
      action: 'Please confirm arrival in the app after you get the keys or access.',
    };
  }
  if (bucket === 'transport') {
    return {
      title: 'Подача / начало аренды',
      lead: 'Сегодня начало аренды по вашему бронированию.',
      action: 'Подтвердите получение в приложении при встрече с партнёром.',
    };
  }
  if (bucket === 'service') {
    return {
      title: 'Начало услуги',
      lead: 'Сегодня день вашей услуги по бронированию.',
      action: 'Подтвердите начало в приложении, когда услуга стартует.',
    };
  }
  return {
    title: 'Заезд',
    lead: 'Сегодня ваш заезд.',
    action: 'Подтвердите прибытие в приложении после заселения или получения ключей.',
  };
}

/**
 * Review reminder — wording by bucket (guest-facing).
 * @param {string | null | undefined} categorySlug
 * @param {'ru' | 'en'} lang
 */
/**
 * Partner nudge: rate the guest after funds are available (THAWED).
 * @param {string | null | undefined} categorySlug
 * @param {'ru' | 'en'} lang
 */
export function getPartnerGuestReviewPromptCopy(categorySlug, lang = 'ru') {
  const bucket = getEscrowThawBucketFromCategorySlug(categorySlug);
  if (lang === 'en') {
    if (bucket === 'transport') {
      return {
        title: 'Rate your guest',
        lead: 'Funds for this rental are available. Share a short review of the guest.',
      };
    }
    if (bucket === 'service') {
      return {
        title: 'Rate your guest',
        lead: 'Funds for this service are available. Share a short review of the guest.',
      };
    }
    return {
      title: 'Rate your guest',
      lead: 'Funds for this stay are available. Share a short review of the guest.',
    };
  }
  if (bucket === 'transport') {
    return {
      title: 'Оцените гостя',
      lead: 'Средства по аренде доступны. Коротко расскажите о госте.',
    };
  }
  if (bucket === 'service') {
    return {
      title: 'Оцените гостя',
      lead: 'Средства по услуге доступны. Коротко расскажите о госте.',
    };
  }
  return {
    title: 'Оцените гостя',
    lead: 'Средства по проживанию доступны. Коротко расскажите о госте.',
  };
}

export function getReviewReminderTelegramCopy(categorySlug, lang = 'ru') {
  const bucket = getEscrowThawBucketFromCategorySlug(categorySlug);
  if (lang === 'en') {
    if (bucket === 'transport') {
      return {
        lead: 'How did the rental go?',
      };
    }
    if (bucket === 'service') {
      return {
        lead: 'How was the service?',
      };
    }
    return {
      lead: 'How was your stay?',
    };
  }
  if (bucket === 'transport') {
    return { lead: 'Как прошла аренда?' };
  }
  if (bucket === 'service') {
    return { lead: 'Как прошла услуга?' };
  }
  return { lead: 'Как прошло проживание?' };
}
