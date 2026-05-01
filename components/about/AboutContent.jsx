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

const PRINCIPLES = [
  { iconKey: 'shield', icon: Shield },
  { iconKey: 'sparkles', icon: Sparkles },
  { iconKey: 'heart', icon: HeartHandshake },
  { iconKey: 'globe', icon: Globe2 },
]

const STR = {
  ru: {
    eyebrow: 'Phuket · Global',
    h1Line1: 'Аренда без посредников —',
    h1Line2: 'только настоящие владельцы.',
    sub: 'Мы объединяем арендодателей и путешественников по всему миру в одну прозрачную экосистему — виллы, яхты, транспорт и туры в пару тапов.',
    principlesH2: 'Что для нас важно',
    principles: [
      { title: 'Прозрачность', desc: 'Без скрытых комиссий и комиссионеров. Только проверенные партнёры.' },
      { title: 'Премиум-сервис', desc: 'Курируем каждый объект, чтобы аренда оставалась впечатлением, а не сделкой.' },
      { title: 'Безопасность', desc: 'Escrow-защита платежей и круглосуточная поддержка на 4 языках.' },
      { title: 'Глобальный охват', desc: 'Гости и партнёры со всего мира — Россия, Таиланд, Бали, Дубай и далее.' },
    ],
    storyH2: 'Наша история',
    storyParas: [
      `${getSiteDisplayName()} появился, когда мы сами столкнулись с хаосом аренды: десятки чатов, разрозненных сайтов и посредников, накручивающих цену.`,
      'Мы сделали платформу, где всё прозрачно: реальные фото, честные цены, защита средств до заселения. Без двойных стандартов и скрытых комиссий.',
      'Сегодня у нас тысячи объектов и гости из десятков стран — но цель прежняя: сделать аренду такой же простой, как заказать такси.',
    ],
    ctaH2: 'Начните своё путешествие',
    ctaSub: 'Откройте тысячи проверенных объектов по всему миру — от вилл с видом на океан до яхт и авто.',
    ctaPrimary: 'Найти объект →',
    ctaSecondary: 'Центр помощи',
  },
  en: {
    eyebrow: 'Phuket · Global',
    h1Line1: 'Rentals without middlemen —',
    h1Line2: 'real owners only.',
    sub: 'We connect property hosts and travelers worldwide into one transparent ecosystem — villas, yachts, vehicles, and tours in just a few taps.',
    principlesH2: 'What we care about',
    principles: [
      { title: 'Transparency', desc: 'No hidden fees or middlemen. Verified partners only.' },
      { title: 'Premium service', desc: 'Every listing is curated so renting stays an experience, not a transaction.' },
      { title: 'Safety', desc: 'Escrow-protected payments and 24/7 support in 4 languages.' },
      { title: 'Global reach', desc: 'Guests and hosts worldwide — Russia, Thailand, Bali, Dubai and beyond.' },
    ],
    storyH2: 'Our story',
    storyParas: [
      `${getSiteDisplayName()} was born when we ourselves faced the rental chaos: dozens of chats, scattered sites, and middlemen marking up the price.`,
      'We built a platform where everything is transparent: real photos, fair prices, escrow-protected funds. No double standards, no hidden fees.',
      'Today we host thousands of listings and guests from dozens of countries — but the goal is the same: make renting as easy as calling a cab.',
    ],
    ctaH2: 'Start your journey',
    ctaSub: 'Discover thousands of verified rentals worldwide — from ocean-view villas to yachts and cars.',
    ctaPrimary: 'Find a place →',
    ctaSecondary: 'Help Center',
  },
  zh: {
    eyebrow: '普吉岛 · 全球',
    h1Line1: '不通过中介的租赁 —',
    h1Line2: '仅限真实房东。',
    sub: '我们将全球房东与旅客联结成一个透明的生态系统 — 别墅、游艇、车辆和旅行体验，只需几次点击。',
    principlesH2: '我们重视的事',
    principles: [
      { title: '透明', desc: '无隐藏费用和中介。仅限经认证的合作伙伴。' },
      { title: '精品服务', desc: '我们精选每一个房源，让租赁保持为一次体验而非简单交易。' },
      { title: '安全', desc: '托管支付保护，全天候 4 种语言支持。' },
      { title: '全球覆盖', desc: '来自世界各地的客人和房东 — 俄罗斯、泰国、巴厘岛、迪拜等。' },
    ],
    storyH2: '我们的故事',
    storyParas: [
      `${getSiteDisplayName()}诞生于我们自己面对租赁混乱时：数十个聊天、分散的网站和加价的中介。`,
      '我们打造了一个一切透明的平台：真实照片、公道价格、入住前托管的资金。没有双重标准，没有隐藏费用。',
      '今天，我们拥有数千个房源和来自数十个国家的客人 — 但目标依然如初：让租赁像叫出租车一样简单。',
    ],
    ctaH2: '开启您的旅程',
    ctaSub: '探索全球数千个经认证的房源 — 从海景别墅到游艇和汽车。',
    ctaPrimary: '查找房源 →',
    ctaSecondary: '帮助中心',
  },
  th: {
    eyebrow: 'ภูเก็ต · ระดับโลก',
    h1Line1: 'เช่าตรงโดยไม่ผ่านคนกลาง —',
    h1Line2: 'เจ้าของจริงเท่านั้น',
    sub: 'เราเชื่อมโยงเจ้าของที่พักและนักเดินทางทั่วโลกเข้าด้วยกันในระบบที่โปร่งใส — วิลล่า เรือยอชต์ ยานพาหนะ และทัวร์ ในไม่กี่คลิก',
    principlesH2: 'สิ่งที่เราใส่ใจ',
    principles: [
      { title: 'ความโปร่งใส', desc: 'ไม่มีค่าธรรมเนียมแฝงหรือคนกลาง พาร์ทเนอร์ที่ตรวจสอบแล้วเท่านั้น' },
      { title: 'บริการระดับพรีเมียม', desc: 'เราคัดสรรทุกที่พักเพื่อให้การเช่ายังคงเป็นประสบการณ์ ไม่ใช่แค่ธุรกรรม' },
      { title: 'ความปลอดภัย', desc: 'การชำระเงินผ่านเอสโครว์ พร้อมการสนับสนุน 24/7 ใน 4 ภาษา' },
      { title: 'ครอบคลุมทั่วโลก', desc: 'แขกและเจ้าของจากทั่วโลก — รัสเซีย ไทย บาหลี ดูไบ และอื่น ๆ' },
    ],
    storyH2: 'เรื่องราวของเรา',
    storyParas: [
      `${getSiteDisplayName()} ถือกำเนิดขึ้นเมื่อพวกเราเองต้องเผชิญกับความวุ่นวายของการเช่า: แชทมากมาย เว็บไซต์กระจัดกระจาย และคนกลางที่บวกราคา`,
      'เราสร้างแพลตฟอร์มที่ทุกอย่างโปร่งใส: ภาพจริง ราคายุติธรรม เงินอยู่ในเอสโครว์จนกว่าจะเข้าพัก ไม่มีมาตรฐานสองมาตรฐาน ไม่มีค่าธรรมเนียมแฝง',
      'วันนี้เรามีที่พักนับพันแห่งและแขกจากหลายสิบประเทศ — แต่เป้าหมายเดิม: ทำให้การเช่าง่ายเหมือนเรียกแท็กซี่',
    ],
    ctaH2: 'เริ่มต้นการเดินทางของคุณ',
    ctaSub: 'ค้นพบที่พักที่ตรวจสอบแล้วนับพันแห่งทั่วโลก — ตั้งแต่วิลล่าวิวทะเล เรือยอชต์ ไปจนถึงรถยนต์',
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
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-50/60 via-white to-amber-50/40 border-b border-slate-100">
        <div className="container mx-auto px-4 pt-24 sm:pt-28 pb-16 sm:pb-20 max-w-4xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
            {getSiteDisplayName()} · {s.eyebrow}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.05] mb-6">
            {s.h1Line1}<br />
            <span className="text-[#006666]">{s.h1Line2}</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl">{s.sub}</p>
        </div>
      </section>

      {/* Principles */}
      <section className="container mx-auto px-4 py-16 sm:py-20 max-w-5xl">
        <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-10 text-center">
          {s.principlesH2}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {s.principles.map((p, i) => {
            const Icon = PRINCIPLES[i].icon
            return (
              <div
                key={p.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 transition-all duration-300 hover:border-teal-300 hover:shadow-[0_20px_48px_rgba(15,23,42,0.08)]"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-[#006666]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-xl font-semibold text-slate-900 mb-2">{p.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{p.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Story */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="container mx-auto px-4 py-16 sm:py-20 max-w-3xl">
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-6">
            {s.storyH2}
          </h2>
          <div className="space-y-5 text-slate-600 text-lg leading-relaxed">
            {s.storyParas.map((para, i) => <p key={i}>{para}</p>)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 sm:py-20 max-w-4xl text-center">
        <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-4">
          {s.ctaH2}
        </h2>
        <p className="text-base sm:text-lg text-slate-600 mb-8 max-w-2xl mx-auto">{s.ctaSub}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/listings"
            className="inline-flex items-center justify-center rounded-2xl bg-[#006666] px-7 py-4 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(0,102,102,0.32)] transition-all hover:bg-[#005555] active:scale-[0.98]"
          >
            {s.ctaPrimary}
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-7 py-4 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-400 hover:text-teal-700"
          >
            {s.ctaSecondary}
          </Link>
        </div>
      </section>
    </main>
  )
}
