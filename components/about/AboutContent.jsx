'use client'

/**
 * AboutContent — клиентский компонент с i18n.
 * Сервер-обёртка `/app/app/about/page.js` устанавливает metadata, делегирует UI сюда.
 *
 * @created 2026-02 Global Pivot — мультиязычная страница О нас
 */

import Link from 'next/link'
import { useI18n } from '@/contexts/i18n-context'
import { getSiteDisplayName } from '@/lib/site-url'
import { Shield, Sparkles, HeartHandshake, Globe2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'

const PRINCIPLES = [
  { iconKey: 'shield', icon: Shield },
  { iconKey: 'sparkles', icon: Sparkles },
  { iconKey: 'heart', icon: HeartHandshake },
  { iconKey: 'globe', icon: Globe2 },
]

const STR = {
  ru: {
    eyebrow: 'Супер-приложение',
    h1Line1: 'Прямая связь с собственниками',
    h1Line2: 'и их представителями.',
    sub: 'Сейчас основной фокус — жильё в Таиланде и России. Другие типы аренды тоже публикуются, если объявление прошло модерацию. Платформа — посредник между гостем и партнёром.',
    principlesH2: 'Что для нас важно',
    principles: [
      { title: 'Прозрачность', desc: 'Сервисный сбор виден до оплаты. Мы не прячем комиссию платформы в «мелкий шрифт».' },
      { title: 'Модерация', desc: 'Публикуем объявления после проверки. Это не гарантия, что партнёр — собственник: это может быть уполномоченный представитель.' },
      { title: 'Защита платежа', desc: 'Средства удерживаются платёжным партнёром и передаются партнёру только после подтверждения заселения.' },
      { title: 'Поддержка', desc: 'Заботливая служба поддержки в рабочие часы — без обещания круглосуточного колл-центра.' },
    ],
    storyH2: 'Наша история',
    storyParas: [
      `${getSiteDisplayName()} создаётся небольшой командой основателей и друзей. Идея родилась из нашего опыта поездок на Пхукет и по России: комиссии посредников, хаос в Telegram, переводы из РФ и риск остаться без денег.`,
      'Мы строим сервис так, как сделали бы его для себя — с фокусом на прозрачности, безопасности оплаты и жилье из первых рук. Платформа соединяет гостя и партнёра: договор на услугу — между ними.',
    ],
    ctaH2: 'Начните бронирование',
    ctaSub: 'Смотрите объявления, прошедшие модерацию. Условия отмены и возврата — в карточке объекта и в оферте.',
    ctaPrimary: 'Найти объект →',
    ctaSecondary: 'Центр помощи',
  },
  en: {
    eyebrow: 'Super App',
    h1Line1: 'Direct connection with owners',
    h1Line2: 'and their representatives.',
    sub: 'Our current focus is stays in Thailand and Russia. Other rental types are listed when a listing passes moderation. The platform is an intermediary between the guest and the partner.',
    principlesH2: 'What we care about',
    principles: [
      { title: 'Transparency', desc: 'The platform service fee is shown before you pay. We do not hide it in the fine print.' },
      { title: 'Moderation', desc: 'Listings go live after review. That is not a guarantee the partner is the owner — they may be an authorised representative.' },
      { title: 'Payment protection', desc: 'Funds are held by the payment partner and released to the partner only after check-in is confirmed.' },
      { title: 'Support', desc: 'A dedicated support team during business hours — we do not promise a 24/7 call centre.' },
    ],
    storyH2: 'Our story',
    storyParas: [
      `${getSiteDisplayName()} is built by a small team of founders and friends. The idea came from our own trips to Phuket and around Russia: middleman mark-ups, Telegram chaos, transfers from Russia, and the risk of losing money.`,
      'We are building the service we would use ourselves — transparent fees, protected payments, and listings from the people who actually provide them. The rental agreement is between guest and partner.',
    ],
    ctaH2: 'Start a booking',
    ctaSub: 'Browse listings that passed moderation. Cancellation and refunds follow the listing card and the public offer.',
    ctaPrimary: 'Find a listing →',
    ctaSecondary: 'Help Center',
  },
  zh: {
    eyebrow: '超级应用',
    h1Line1: '直接联系业主',
    h1Line2: '及其授权代表。',
    sub: '当前重点是泰国与俄罗斯的住宿。其他租赁类型在通过审核后也会上架。平台是客人与合作伙伴之间的中介。',
    principlesH2: '我们重视的事',
    principles: [
      { title: '透明', desc: '平台服务费在付款前可见，不会藏在小字里。' },
      { title: '审核', desc: '房源上架前会审核。这不保证合作伙伴就是业主，也可能是授权代表。' },
      { title: '付款保护', desc: '资金由支付合作方代管，仅在确认入住后转给合作伙伴。' },
      { title: '支持', desc: '工作时间内的客服支持，不承诺全天候呼叫中心。' },
    ],
    storyH2: '我们的故事',
    storyParas: [
      `${getSiteDisplayName()} 由一小支创始团队打造。灵感来自我们在普吉岛和俄罗斯的出行：中介加价、Telegram 混乱、从俄罗斯汇款，以及钱款落空的风险。`,
      '我们按自己会用的方式来做：费用透明、付款受保护、由实际提供服务的人发布。租赁合同在客人与合作伙伴之间订立。',
    ],
    ctaH2: '开始预订',
    ctaSub: '浏览已通过审核的房源。取消与退款以房源规则和要约为准。',
    ctaPrimary: '查找房源 →',
    ctaSecondary: '帮助中心',
  },
  th: {
    eyebrow: 'ซูเปอร์แอป',
    h1Line1: 'ติดต่อเจ้าของโดยตรง',
    h1Line2: 'และผู้แทนที่ได้รับมอบอำนาจ',
    sub: 'ตอนนี้เน้นที่พักในไทยและรัสเซีย ประเภทเช่าอื่นขึ้นเมื่อผ่านการตรวจสอบ แพลตฟอร์มเป็นตัวกลางระหว่างแขกกับพาร์ทเนอร์',
    principlesH2: 'สิ่งที่เราใส่ใจ',
    principles: [
      { title: 'ความโปร่งใส', desc: 'ค่าบริการแพลตฟอร์มแสดงก่อนชำระ ไม่ซ่อนในตัวพิมพ์เล็ก' },
      { title: 'การตรวจสอบ', desc: 'ประกาศขึ้นหลังตรวจแล้ว ไม่ได้รับประกันว่าพาร์ทเนอร์คือเจ้าของ — อาจเป็นผู้แทน' },
      { title: 'คุ้มครองการชำระ', desc: 'เงินถูกถือโดยพาร์ทเนอร์ชำระเงิน และโอนให้พาร์ทเนอร์หลังยืนยันเช็คอินเท่านั้น' },
      { title: 'การสนับสนุน', desc: 'ทีมช่วยเหลือในเวลาทำการ — ไม่สัญญาคอลเซ็นเตอร์ 24 ชั่วโมง' },
    ],
    storyH2: 'เรื่องราวของเรา',
    storyParas: [
      `${getSiteDisplayName()} สร้างโดยทีมผู้ก่อตั้งกลุ่มเล็ก ไอเดียมาจากทริปภูเก็ตและรัสเซีย: ค่านายหน้า แชทกระจัดกระจาย การโอนจากรัสเซีย และความเสี่ยงเงินหาย`,
      'เราสร้างบริการแบบที่อยากใช้เอง — ค่าธรรมเนียมโปร่งใส คุ้มครองการจ่าย และประกาศจากผู้ให้บริการจริง สัญญาเช่าอยู่ระหว่างแขกกับพาร์ทเนอร์',
    ],
    ctaH2: 'เริ่มการจอง',
    ctaSub: 'ดูประกาศที่ผ่านการตรวจสอบ กฎยกเลิกและคืนเงินตามการ์ดประกาศและข้อเสนอสาธารณะ',
    ctaPrimary: 'ค้นหาที่พัก →',
    ctaSecondary: 'ศูนย์ช่วยเหลือ',
  },
}

export default function AboutContent() {
  const { language } = useI18n()
  const s = STR[language] || STR.ru

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-brand/10 via-white to-white">
        <div className="container mx-auto px-4 pt-6 sm:pt-8 pb-16 sm:pb-20 max-w-4xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-hover">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            {getSiteDisplayName()} · {s.eyebrow}
          </p>
          <h1 className="mb-6 text-4xl font-semibold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            {s.h1Line1}<br />
            <span className="text-brand">{s.h1Line2}</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl">{s.sub}</p>
        </div>
      </section>

      {/* Principles */}
      <section className="container mx-auto px-4 py-16 sm:py-20 max-w-5xl">
        <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          {s.principlesH2}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {s.principles.map((p, i) => {
            const Icon = PRINCIPLES[i]?.icon || Shield
            return (
              <div
                key={p.title}
                className={cn(
                  MOBILE_FLAT_CARD_CLASS,
                  'max-sm:py-2 sm:p-7 sm:transition-all sm:duration-300 sm:hover:border-brand/30 sm:hover:shadow-[0_20px_48px_rgba(15,23,42,0.08)]',
                )}
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-slate-900">{p.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{p.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Story */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="container mx-auto px-4 py-16 sm:py-20 max-w-3xl">
          <h2 className="mb-6 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {s.storyH2}
          </h2>
          <div className="space-y-5 text-slate-600 text-lg leading-relaxed">
            {s.storyParas.map((para, i) => <p key={i}>{para}</p>)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 sm:py-20 max-w-4xl text-center">
        <h2 className="mb-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          {s.ctaH2}
        </h2>
        <p className="text-base sm:text-lg text-slate-600 mb-8 max-w-2xl mx-auto">{s.ctaSub}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="brand" size="lg" className="px-7 text-sm font-semibold">
            <Link href="/listings">{s.ctaPrimary}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="px-7 text-sm font-semibold">
            <Link href="/help">{s.ctaSecondary}</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
