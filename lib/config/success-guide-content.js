/**
 * Stage 27.0 — SuccessGuide «операционный» пункт чеклиста (редактируется без правки i18n).
 * @typedef {'stay' | 'transport' | 'service' | 'tour'} ListingServiceType
 */

import { normalizeUiLang } from '@/lib/config/lang-normalize'

/** @type {Record<ListingServiceType, Record<'ru'|'en'|'zh'|'th', string>>} */
export const SUCCESS_GUIDE_OPS_RULE_LINES = {
  stay: {
    ru: 'Объект: чистое бельё и уборка, фото соответствуют реальности, ключевые инструкции (заезд/Wi‑Fi) — в чате или в карточке.',
    en: 'Listing: fresh linens & cleaning, photos match reality, key instructions (check-in/Wi‑Fi) in chat or on the card.',
    zh: '房源：床品清洁、照片与实物一致，入住/Wi‑Fi 等关键说明写在聊天或卡片中。',
    th: 'ที่พัก: ผ้าเช็ดตัว/เครื่องนอนสะอาด รูปตรงของจริง คำแนะนำเช็คอิน/Wi‑Fi ในแชทหรือการ์ด',
  },
  transport: {
    ru: 'Транспорт: проверьте уровень топлива, страховку и техсостояние до выдачи; фиксируйте пробег/повреждения при приёмке.',
    en: 'Transport: check fuel, insurance, and mechanical condition before handover; note mileage/damage at pickup/return.',
    zh: '交通：交车前检查油量、保险与车况；取还车时记录里程与车损。',
    th: 'ยานพาหนะ: ตรวจน้ำมัน ประกัน และสภาพก่อนส่งมอบ; จดเลขไมล์/ความเสียหายตอนรับ-คืน',
  },
  service: {
    ru: 'Услуга: приходите вовремя, заранее согласуйте формат встречи и границы ответственности в чате.',
    en: 'Service: be on time, confirm meeting format and scope of responsibility in chat beforehand.',
    zh: '服务：准时到场，提前在聊天确认见面方式与责任边界。',
    th: 'บริการ: ตรงเวลา ยืนยันรูปแบบการพบและขอบเขตความรับผิดชอบในแชทล่วงหน้า',
  },
  tour: {
    ru: 'Тур: маршрут и время старта подтверждены, группа и погодные риски учтены; экстренные контакты — в описании.',
    en: 'Tour: route and start time confirmed, group size and weather risks covered; emergency contacts in the listing.',
    zh: '行程：路线与集合时间已确认，人数与天气风险已考虑；紧急联系方式写在描述里。',
    th: 'ทัวร์: เส้นทางและเวลาเริ่มชัดเจน จำนวนกลุ่มและความเสี่ยงสภาพอากาศ; เบอร์ฉุกเฉินในรายละเอียด',
  },
}

/**
 * @param {ListingServiceType} kind
 * @param {unknown} language
 */
export function getSuccessGuideOpsRuleLine(kind, language) {
  const L = normalizeUiLang(language)
  const k = kind && SUCCESS_GUIDE_OPS_RULE_LINES[kind] ? kind : 'stay'
  return SUCCESS_GUIDE_OPS_RULE_LINES[k][L] || SUCCESS_GUIDE_OPS_RULE_LINES.stay.en
}
