/**
 * Push / Telegram copy by listing category (PR-#2).
 * Bucket — только через реестр `lib/config/category-behavior.js` (Stage 53.0).
 */

import { getEscrowThawBucketFromRegistry } from '@/lib/config/category-behavior'

/**
 * @param {string | null | undefined} categorySlug
 * @param {'ru' | 'en'} lang
 */
export function getCheckInReminderTelegramCopy(categorySlug, lang = 'ru') {
  const bucket = getEscrowThawBucketFromRegistry(categorySlug);
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
 * Partner nudge: rate the client after the booking period ended (post check_out).
 * @param {string | null | undefined} categorySlug
 * @param {'ru' | 'en' | 'zh' | 'th'} lang
 */
export function getPartnerGuestReviewPromptCopy(categorySlug, lang = 'ru') {
  const bucket = getEscrowThawBucketFromRegistry(categorySlug);
  const L = lang === 'en' || lang === 'zh' || lang === 'th' ? lang : 'ru';

  if (L === 'en') {
    if (bucket === 'transport') {
      return {
        title: 'Review your client',
        lead: 'This rental period has ended. Please leave a short review of the client.',
      };
    }
    if (bucket === 'service') {
      return {
        title: 'Review your client',
        lead: 'This service booking has ended. Please leave a short review of the client.',
      };
    }
    return {
      title: 'Review your client',
      lead: 'This stay has ended. Please leave a short review of the client.',
    };
  }
  if (L === 'zh') {
    if (bucket === 'transport') {
      return { title: '评价客户', lead: '租期已结束，请留下对客户的简短评价。' };
    }
    if (bucket === 'service') {
      return { title: '评价客户', lead: '服务订单已结束，请留下对客户的简短评价。' };
    }
    return { title: '评价客户', lead: '入住/住宿已结束，请留下对客户的简短评价。' };
  }
  if (L === 'th') {
    if (bucket === 'transport') {
      return {
        title: 'รีวิวลูกค้า',
        lead: 'รอบการเช่าสิ้นสุดแล้ว กรุณาให้คะแนนลูกค้าสั้นๆ',
      };
    }
    if (bucket === 'service') {
      return {
        title: 'รีวิวลูกค้า',
        lead: 'การจองบริการสิ้นสุดแล้ว กรุณาให้คะแนนลูกค้าสั้นๆ',
      };
    }
    return {
      title: 'รีวิวลูกค้า',
      lead: 'การเข้าพักสิ้นสุดแล้ว กรุณาให้คะแนนลูกค้าสั้นๆ',
    };
  }
  if (bucket === 'transport') {
    return {
      title: 'Оцените клиента',
      lead: 'Аренда по бронированию завершена. Коротко расскажите о клиенте.',
    };
  }
  if (bucket === 'service') {
    return {
      title: 'Оцените клиента',
      lead: 'Услуга по бронированию завершена. Коротко расскажите о клиенте.',
    };
  }
  return {
    title: 'Оцените клиента',
    lead: 'Проживание по бронированию завершено. Коротко расскажите о клиенте.',
  };
}

export function getReviewReminderTelegramCopy(categorySlug, lang = 'ru') {
  const bucket = getEscrowThawBucketFromRegistry(categorySlug);
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
