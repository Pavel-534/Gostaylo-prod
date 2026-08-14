'use client'

/**
 * AboutContent — i18n About page.
 * Stage 201.31 — MarketingDocChrome shared with Terms / Help / Legal.
 */

import Link from 'next/link'
import { useI18n } from '@/contexts/i18n-context'
import { getSiteDisplayName } from '@/lib/site-url'
import { Shield, Sparkles, HeartHandshake, Globe2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'
import { MarketingDocChrome } from '@/components/marketing/MarketingDocChrome'

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
      'Идея проекта родилась из нашего собственного опыта путешествий и поиска жилья. Когда мы пытались забронировать дом на Пхукете и в регионах России, то столкнулись со всеми знакомыми трудностями: хаос в безымянных Telegram-чатах, ощутимые наценки посредников, сложности с международными переводами и постоянный риск перевести деньги «в никуда».',
      'С другой стороны — тысячи замечательных собственников жилья, которые просто хотят сдавать свои объекты порядочным гостям без лишних барьеров.',
      `Мы объединились небольшой командой основателей и друзей, чтобы построить ${getSiteDisplayName()} так, как сделали бы его для себя и своих близких. Мы сфокусировались на прямой связи с собственниками и их представителями, прозрачности условий и надёжной защите платежей.`,
      'Наш главный приоритет сегодня — удобная и безопасная аренда недвижимости в Таиланде и России. Мы развиваем платформу шаг за шагом, уделяя внимание качеству каждого объявления.',
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
      'The idea came from our own travel and house-hunting. Trying to book a home in Phuket and across Russia, we hit the same familiar friction: chaotic anonymous Telegram chats, middleman mark-ups, awkward international transfers, and the constant risk of sending money into the void.',
      'On the other side are thousands of thoughtful owners who simply want to host decent guests without unnecessary barriers.',
      `We came together as a small team of founders and friends to build ${getSiteDisplayName()} the way we would build it for ourselves and the people we care about — direct connection with owners and their representatives, clear terms, and protected payments.`,
      'Our priority today is convenient, safer property rentals in Thailand and Russia. We grow the platform step by step, focusing on the quality of every listing.',
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
      '项目想法来自我们自己的出行与找房经历。在普吉岛和俄罗斯各地预订住房时，我们遇到了熟悉的麻烦：匿名 Telegram 群聊的混乱、中介加价、跨境汇款不便，以及把钱打进“黑洞”的风险。',
      '另一方面，也有许多真诚的业主，只想把房源租给靠谱的客人，而不想面对多余门槛。',
      `我们由一小支创始人和朋友组成团队，按自己与家人会用的方式打造 ${getSiteDisplayName()}：直接联系业主及其代表、条件透明、付款受保护。`,
      '今天我们的重点是泰国与俄罗斯便捷、更安全的房产租赁。我们一步步打磨平台，认真对待每一条房源。',
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
      'ไอเดียเกิดจากประสบการณ์ท่องเที่ยวและหาที่พักของเราเอง เมื่อพยายามจองบ้านที่ภูเก็ตและในภูมิภาครัสเซีย เราเจอปัญหาคุ้นเคย: แชท Telegram ไร้ชื่อวุ่นวาย ค่านายหน้า การโอนเงินระหว่างประเทศยุ่งยาก และความเสี่ยงส่งเงินไปแล้วหาย',
      'อีกด้านหนึ่งมีเจ้าของที่พักจำนวนมากที่อยากให้เช่าแก่แขกที่สุจริตโดยไม่มีอุปสรรคเกินจำเป็น',
      `เราเป็นทีมผู้ก่อตั้งและเพื่อนกลุ่มเล็ก สร้าง ${getSiteDisplayName()} แบบที่อยากใช้เองและให้คนใกล้ชิดใช้ — ติดต่อเจ้าของและผู้แทนโดยตรง เงื่อนไขโปร่งใส และคุ้มครองการชำระเงิน`,
      'วันนี้ลำดับแรกของเราคือการเช่าอสังหาริมทรัพย์ในไทยและรัสเซียที่สะดวกและปลอดภัยกว่า เราพัฒนาแพลตฟอร์มทีละขั้น โดยใส่ใจคุณภาพของทุกประกาศ',
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
    <MarketingDocChrome
      unwrapped
      eyebrow={
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
          {getSiteDisplayName()} · {s.eyebrow}
        </>
      }
      title={
        <>
          {s.h1Line1}
          <br />
          <span className="text-brand">{s.h1Line2}</span>
        </>
      }
      lead={s.sub}
    >
      <section className="container mx-auto max-w-5xl px-4 py-14 sm:py-16">
        <h2 className="mb-10 text-center text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          {s.principlesH2}
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
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
                <p className="text-sm leading-relaxed text-slate-600">{p.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50">
        <div className="container mx-auto max-w-3xl px-4 py-14 sm:py-16">
          <h2 className="mb-6 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {s.storyH2}
          </h2>
          <div className="space-y-5 text-lg leading-relaxed text-slate-600">
            {s.storyParas.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-4xl px-4 py-14 text-center sm:py-16">
        <h2 className="mb-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          {s.ctaH2}
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-base text-slate-600 sm:text-lg">{s.ctaSub}</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="px-7 text-sm font-semibold">
            <Link href="/listings">{s.ctaPrimary}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="px-7 text-sm font-semibold">
            <Link href="/help">{s.ctaSecondary}</Link>
          </Button>
        </div>
      </section>
    </MarketingDocChrome>
  )
}
