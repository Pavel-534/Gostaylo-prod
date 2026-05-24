'use client'

/**
 * TermsContent — клиентский компонент i18n /terms.
 * Сервер-обёртка устанавливает metadata и делегирует UI сюда.
 *
 * @created 2026-02 Global Pivot — мультиязычные Условия использования
 */

import Link from 'next/link'
import { useI18n } from '@/contexts/i18n-context'
import { getSiteDisplayName } from '@/lib/site-url'
import { getPublicSupportEmail } from '@/lib/config/public-support-email'
import { ScrollText, Mail } from 'lucide-react'

const STR = {
  ru: {
    eyebrow: 'Legal',
    h1: 'Условия использования',
    sub: 'Краткое описание сервиса. Юридически обязательные условия — в Публичной оферте (ссылка ниже).',
    effectiveFrom: 'Действует с 18 мая 2026',
    fullOfferCta: 'Полная версия — Публичная оферта',
    sections: [
      { n: '01', title: 'Платформа и роли', body: [
        `${getSiteDisplayName()} — технологическая платформа, объединяющая владельцев объектов аренды и гостей. Мы выступаем посредником (агентом) и не являемся стороной договора аренды между Гостем и Партнёром.`,
        'Платформа доступна арендаторам (Гостям) и арендодателям (Партнёрам). Подробные права и обязанности — в Публичной оферте.',
      ] },
      { n: '02', title: 'Бронирование и оплата', body: [
        'Все цены отображаются с учётом сервисного сбора платформы до оплаты; скрытых удержаний со стороны платформы нет.',
        'Оплата проходит через платёжного провайдера. До подтверждения заселения сумма учитывается как обеспечение исполнения бронирования; расчёты с Партнёром — после наступления условий в оферте и правилах объявления.',
        'Курс конвертации валют (THB / USD / EUR / RUB / CNY) фиксируется в момент оплаты по данным внешнего поставщика котировок.',
      ] },
      { n: '03', title: 'Защита бронирования', body: [
        'Модель направлена на снижение рисков для Гостя и Партнёра при недопоставке услуги. Порядок возвратов — в политике возвратов и оферте.',
        'При подтверждённых нарушениях со стороны Партнёра (несоответствие объекта, отсутствие доступа) применяются правила возврата, указанные для бронирования.',
      ] },
      { n: '04', title: 'Отмена бронирования', body: [
        'Условия отмены указываются в карточке каждого объекта. Стандартная политика — бесплатная отмена за 7 дней до заезда.',
        'При отмене Партнёром по причинам, не зависящим от Гостя, оплата возвращается в полном объёме.',
      ] },
      { n: '05', title: 'Персональные данные', body: [
        'Мы обрабатываем персональные данные в соответствии с GDPR, ФЗ-152 РФ и PDPA Королевства Таиланд.',
        'Cookies используются для аутентификации, поддержки сессий, аналитики и персонализации поиска. Управлять можно в настройках браузера.',
      ] },
      { n: '06', title: 'Запрещённый контент', body: [
        'Запрещено размещать объекты, нарушающие законодательство юрисдикции их размещения, а также использовать платформу для отмывания средств, мошенничества или дискриминации.',
        'Мы оставляем за собой право блокировать аккаунты и объекты при выявлении нарушений.',
      ] },
      { n: '07', title: 'Изменения условий', body: [
        'Платформа может обновлять данные условия. Существенные изменения уведомляются заранее по email и в личном кабинете.',
        'Продолжая пользоваться сервисом после вступления изменений в силу, вы соглашаетесь с новой редакцией.',
      ] },
    ],
    contactH2: 'Публичная оферта',
    contactSub: 'Полный юридический текст, приоритет документов и условия оплаты — в Публичной оферте.',
    helpLink: 'Центр помощи',
  },
  en: {
    eyebrow: 'Legal',
    h1: 'Terms of Service',
    sub: 'A short overview of the service. The binding terms are in the Public Offer (link below).',
    effectiveFrom: 'Effective from May 18, 2026',
    fullOfferCta: 'Full version — Public Offer',
    sections: [
      { n: '01', title: 'Platform & roles', body: [
        `${getSiteDisplayName()} is a technology platform connecting rental owners with guests. We act as an intermediary (agent) and are not a party to the rental contract between Guest and Partner.`,
        'The platform is available to Guests and Partners. Detailed rights and obligations are in the Public Offer.',
      ] },
      { n: '02', title: 'Booking & payment', body: [
        'All prices include the platform service fee before payment; there are no hidden platform charges.',
        'Payment is processed via a payment provider. Until check-in conditions are met, the amount secures the booking; settlement with the Partner follows the Public Offer and listing rules.',
        'Currency conversion (THB / USD / EUR / RUB / CNY) is fixed at payment using an external rates provider.',
      ] },
      { n: '03', title: 'Booking protection', body: [
        'The model is designed to reduce risk for Guests and Partners when service is not delivered. Refunds follow the refund policy and Public Offer.',
        'On confirmed Partner-side violations (mismatch, no access), the refund rules stated for the booking apply.',
      ] },
      { n: '04', title: 'Cancellation', body: [
        'Cancellation terms are specified in each listing. The standard policy is a free cancellation 7 days before check-in.',
        'If the Partner cancels for reasons independent of the Guest, payment is fully refunded.',
      ] },
      { n: '05', title: 'Personal data', body: [
        'We process personal data in accordance with GDPR, RU FL-152, and Thailand’s PDPA.',
        'Cookies are used for authentication, session support, analytics, and search personalization. You can manage them via your browser settings.',
      ] },
      { n: '06', title: 'Prohibited content', body: [
        'Listings violating the laws of the jurisdiction where they are placed are prohibited, as is any use of the platform for money laundering, fraud, or discrimination.',
        'We reserve the right to block accounts and listings upon detected violations.',
      ] },
      { n: '07', title: 'Changes to the terms', body: [
        'The platform may update these terms. Material changes are notified in advance by email and in your dashboard.',
        'By continuing to use the service after changes take effect, you accept the new revision.',
      ] },
    ],
    contactH2: 'Public Offer',
    contactSub: 'The full legal text, document priority, and payment terms are in the Public Offer.',
    helpLink: 'Help Center',
  },
  zh: {
    eyebrow: '法律',
    h1: '服务条款',
    sub: '服务简要说明。具有法律约束力的条款见公开要约（下方链接）。',
    effectiveFrom: '自 2026 年 5 月 18 日起生效',
    fullOfferCta: '完整版本 — 公开要约',
    sections: [
      { n: '01', title: '平台与角色', body: [
        `${getSiteDisplayName()} 是连接出租方与房客的技术平台。我们作为中介（代理），不是房客与合作伙伴之间租赁合同的当事方。`,
        '平台对房客和合作伙伴开放。详细权利义务见公开要约。',
      ] },
      { n: '02', title: '预订与支付', body: [
        '所有价格在支付前已包含平台服务费；平台无隐藏扣款。',
        '付款通过支付服务商处理。在入住条件满足前，金额作为预订履约保障；与合作伙伴的结算按公开要约及房源规则进行。',
        '货币兑换（THB / USD / EUR / RUB / CNY）在支付时按外部汇率锁定。',
      ] },
      { n: '03', title: '预订保障', body: [
        '该模式旨在降低房客与合作伙伴在未能提供服务时的风险。退款见退款政策与公开要约。',
        '在确认的合作伙伴违规情况下，适用该预订所载的退款规则。',
      ] },
      { n: '04', title: '取消', body: [
        '每个房源都标明取消条款。标准政策为入住前 7 天免费取消。',
        '若合作伙伴出于与房客无关的原因取消，款项将全额退还。',
      ] },
      { n: '05', title: '个人数据', body: [
        '我们依据 GDPR、俄罗斯 FL-152 和泰国 PDPA 处理个人数据。',
        'Cookies 用于身份验证、会话支持、分析和搜索个性化。您可以通过浏览器设置进行管理。',
      ] },
      { n: '06', title: '禁止内容', body: [
        '禁止发布违反所在司法辖区法律的房源，禁止将平台用于洗钱、欺诈或歧视。',
        '在发现违规时，我们保留封停账户和房源的权利。',
      ] },
      { n: '07', title: '条款变更', body: [
        '平台可能会更新本条款。重大变更将通过电子邮件和个人中心提前通知。',
        '在变更生效后继续使用本服务，即表示您接受新版本。',
      ] },
    ],
    contactH2: '公开要约',
    contactSub: '完整法律文本、文件优先级及付款条件见公开要约。',
    helpLink: '帮助中心',
  },
  th: {
    eyebrow: 'กฎหมาย',
    h1: 'เงื่อนไขการใช้บริการ',
    sub: 'ภาพรวมสั้นของบริการ ข้อกำหนดที่ผูกพันทางกฎหมายอยู่ในข้อเสนอสาธารณะ (ลิงก์ด้านล่าง)',
    effectiveFrom: 'มีผลตั้งแต่ 18 พฤษภาคม 2026',
    fullOfferCta: 'ฉบับเต็ม — ข้อเสนอสาธารณะ',
    sections: [
      { n: '01', title: 'แพลตฟอร์มและบทบาท', body: [
        `${getSiteDisplayName()} เป็นแพลตฟอร์มเทคโนโลยีที่เชื่อมเจ้าของที่พักกับแขก เราเป็นตัวกลาง (ตัวแทน) และไม่ใช่คู่สัญญาเช่าระหว่างแขกกับพาร์ทเนอร์`,
        'แพลตฟอร์มเปิดให้แขกและพาร์ทเนอร์ รายละเอียดสิทธิและหน้าที่อยู่ในข้อเสนอสาธารณะ',
      ] },
      { n: '02', title: 'การจองและการชำระเงิน', body: [
        'ราคาแสดงรวมค่าธรรมเนียมแพลตฟอร์มก่อนชำระ ไม่มีการหักแอบแฝงจากแพลตฟอร์ม',
        'ชำระผ่านผู้ให้บริการชำระเงิน จนกว่าจะถึงเงื่อนไขเช็คอิน จำนวนเงินเป็นหลักประกันการจอง การชำระกับพาร์ทเนอร์ตามข้อเสนอสาธารณะและกฎประกาศ',
        'อัตราแลกเปลี่ยน (THB / USD / EUR / RUB / CNY) ถูกตรึง ณ เวลาชำระตามผู้ให้บริการอัตราภายนอก',
      ] },
      { n: '03', title: 'การคุ้มครองการจอง', body: [
        'โมเดลนี้ช่วยลดความเสี่ยงเมื่อบริการไม่ถูกส่งมอบ การคืนเงินตามนโยบายคืนเงินและข้อเสนอสาธารณะ',
        'เมื่อยืนยันการละเมิดจากพาร์ทเนอร์ ใช้กฎคืนเงินที่ระบุสำหรับการจองนั้น',
      ] },
      { n: '04', title: 'การยกเลิก', body: [
        'เงื่อนไขการยกเลิกระบุไว้ในแต่ละที่พัก นโยบายมาตรฐานคือยกเลิกฟรี 7 วันก่อนเช็คอิน',
        'หากพาร์ทเนอร์ยกเลิกด้วยเหตุที่ไม่เกี่ยวกับแขก จะคืนเงินเต็มจำนวน',
      ] },
      { n: '05', title: 'ข้อมูลส่วนบุคคล', body: [
        'เราดำเนินการกับข้อมูลส่วนบุคคลตาม GDPR, FL-152 ของรัสเซีย และ PDPA ของประเทศไทย',
        'Cookies ใช้เพื่อการยืนยันตัวตน การรองรับเซสชัน การวิเคราะห์ และการปรับแต่งการค้นหา จัดการได้ในการตั้งค่าเบราว์เซอร์',
      ] },
      { n: '06', title: 'เนื้อหาต้องห้าม', body: [
        'ห้ามลงประกาศที่ขัดต่อกฎหมายของเขตอำนาจศาลที่มันถูกเผยแพร่ ห้ามใช้แพลตฟอร์มเพื่อฟอกเงิน ฉ้อโกง หรือการเลือกปฏิบัติ',
        'เราขอสงวนสิทธิ์ในการระงับบัญชีและประกาศเมื่อตรวจพบการละเมิด',
      ] },
      { n: '07', title: 'การเปลี่ยนแปลงเงื่อนไข', body: [
        'แพลตฟอร์มอาจอัปเดตเงื่อนไขเหล่านี้ การเปลี่ยนแปลงสำคัญจะถูกแจ้งล่วงหน้าทางอีเมลและในบัญชีของคุณ',
        'การใช้งานต่อหลังจากการเปลี่ยนแปลงมีผลถือเป็นการยอมรับฉบับใหม่',
      ] },
    ],
    contactH2: 'ข้อเสนอสาธารณะ',
    contactSub: 'ข้อความทางกฎหมายฉบับเต็ม ลำดับเอกสาร และเงื่อนไขการชำระเงินอยู่ในข้อเสนอสาธารณะ',
    helpLink: 'ศูนย์ช่วยเหลือ',
  },
}

export default function TermsContent() {
  const { language } = useI18n()
  const s = STR[language] || STR.ru
  const supportEmail = getPublicSupportEmail()

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand/10 via-white to-amber-50/40 border-b border-slate-100">
        <div className="container mx-auto px-4 pt-24 sm:pt-28 pb-14 sm:pb-16 max-w-4xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-hover">
            <ScrollText className="h-3 w-3" />
            {s.eyebrow} · {getSiteDisplayName()}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.05] mb-5">
            {s.h1}
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">{s.sub}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">{s.effectiveFrom}</p>
          <Link
            href="/legal/public-offer/"
            className="mt-6 inline-flex items-center justify-center rounded-2xl border border-brand/25 bg-white px-6 py-3 text-sm font-semibold text-brand-hover shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/10"
          >
            {s.fullOfferCta}
          </Link>
        </div>
      </section>

      {/* Sections */}
      <section className="container mx-auto px-4 py-14 sm:py-20 max-w-4xl">
        <div className="space-y-10 sm:space-y-12">
          {s.sections.map((sec) => (
            <article
              key={sec.n}
              data-testid={`terms-section-${sec.n}`}
              className="grid grid-cols-1 sm:grid-cols-[80px_1fr] gap-3 sm:gap-8"
            >
              <div>
                <span className="font-serif text-3xl sm:text-4xl font-semibold text-brand/80 tracking-tight">
                  {sec.n}
                </span>
              </div>
              <div>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 mb-3">
                  {sec.title}
                </h2>
                <div className="space-y-3 text-slate-600 leading-relaxed text-base sm:text-[17px]">
                  {sec.body.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="container mx-auto px-4 py-14 sm:py-16 max-w-3xl text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-hover text-white shadow-[0_10px_28px_rgba(0,102,102,0.32)]">
            <Mail className="h-5 w-5" />
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-3">
            {s.contactH2}
          </h2>
          <p className="text-slate-600 mb-7 max-w-xl mx-auto">{s.contactSub}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/legal/public-offer/"
              className="inline-flex items-center justify-center rounded-2xl bg-brand px-7 py-4 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(0,102,102,0.32)] transition-all hover:bg-[#005555] active:scale-[0.98]"
            >
              {s.fullOfferCta}
            </Link>
            <Link
              href="/help/"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-7 py-4 text-sm font-semibold text-slate-700 transition-colors hover:border-brand/40 hover:text-brand-hover"
            >
              {s.helpLink}
            </Link>
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-7 py-4 text-sm font-semibold text-slate-700 transition-colors hover:border-brand/40 hover:text-brand-hover"
            >
              {supportEmail}
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
