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
import { ScrollText, Mail } from 'lucide-react'

const STR = {
  ru: {
    eyebrow: 'Legal',
    h1: 'Условия использования',
    sub: 'Краткая редакция в стиле «Premium Air». Полная версия Пользовательского Соглашения доступна по запросу в поддержку.',
    effectiveFrom: 'Действует с 1 февраля 2026',
    sections: [
      { n: '01', title: 'Платформа и роли', body: [
        `${getSiteDisplayName()} — технологическая платформа, объединяющая владельцев объектов аренды и гостей. Мы выступаем посредником и не являемся стороной договора аренды между ними.`,
        'Платформа доступна арендаторам (Гостям) и арендодателям (Партнёрам). Каждой роли соответствует свой набор прав и обязанностей, описанных в полной версии Соглашения.',
      ] },
      { n: '02', title: 'Бронирование и оплата', body: [
        'Все цены отображаются с учётом сервисного сбора платформы. Скрытых комиссий нет.',
        'Оплата резервируется на escrow-счёте платформы и переводится Партнёру только после успешного заселения Гостя.',
        'Курс конвертации валют (THB / USD / EUR / RUB / CNY) фиксируется в момент оплаты по данным внешнего поставщика котировок.',
      ] },
      { n: '03', title: 'Escrow-защита', body: [
        'Средства Гостя удерживаются на счёте платформы до подтверждения заселения. Это страхует обе стороны от мошенничества.',
        'При подтверждённых нарушениях со стороны Партнёра (несоответствие объекта, отсутствие доступа) Гостю возвращается полная стоимость аренды в течение 14 рабочих дней.',
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
    contactH2: 'Нужна полная версия?',
    contactSub: 'Запросите развёрнутый PDF или задайте вопрос по любому пункту — мы отвечаем на 4 языках.',
    helpLink: 'Центр помощи',
  },
  en: {
    eyebrow: 'Legal',
    h1: 'Terms of Service',
    sub: 'Concise “Premium Air” edition. The full User Agreement is available on request from support.',
    effectiveFrom: 'Effective from February 1, 2026',
    sections: [
      { n: '01', title: 'Platform & roles', body: [
        `${getSiteDisplayName()} is a technology platform connecting rental owners with guests. We act as an intermediary and are not a party to the rental contract between them.`,
        'The platform is available to renters (Guests) and lessors (Partners). Each role has its own rights and obligations described in the full Agreement.',
      ] },
      { n: '02', title: 'Booking & payment', body: [
        'All prices include the platform service fee. There are no hidden fees.',
        'Funds are held on the platform’s escrow account and transferred to the Partner only after a successful check-in.',
        'Currency conversion (THB / USD / EUR / RUB / CNY) is fixed at the moment of payment using an external rates provider.',
      ] },
      { n: '03', title: 'Escrow protection', body: [
        'Guest funds are held on the platform until check-in is confirmed, protecting both sides from fraud.',
        'On confirmed Partner-side violations (mismatch, no access), the Guest is fully refunded within 14 business days.',
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
    contactH2: 'Need the full version?',
    contactSub: 'Request the detailed PDF or ask any question — we respond in 4 languages.',
    helpLink: 'Help Center',
  },
  zh: {
    eyebrow: '法律',
    h1: '服务条款',
    sub: '"Premium Air" 风格的简明版本。完整《用户协议》可向支持申请。',
    effectiveFrom: '自 2026 年 2 月 1 日起生效',
    sections: [
      { n: '01', title: '平台与角色', body: [
        `${getSiteDisplayName()} 是一个连接出租方与房客的技术平台。我们作为中介，不是双方租赁合同的当事方。`,
        '平台对承租人（房客）和出租人（合作伙伴）开放。每种角色都有完整协议中描述的权利与义务。',
      ] },
      { n: '02', title: '预订与支付', body: [
        '所有价格均包含平台服务费，无隐藏费用。',
        '资金保留在平台的托管账户上，仅在房客成功入住后才转交给合作伙伴。',
        '货币兑换（THB / USD / EUR / RUB / CNY）在支付时使用外部汇率提供商锁定。',
      ] },
      { n: '03', title: '托管保护', body: [
        '在确认入住前，房客资金保留在平台，保护双方免遭欺诈。',
        '在确认的合作伙伴违规（不符、无法入住）情况下，房客可在 14 个工作日内全额退款。',
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
    contactH2: '需要完整版本？',
    contactSub: '索取详细 PDF 或就任意条款提问 — 我们以 4 种语言回复。',
    helpLink: '帮助中心',
  },
  th: {
    eyebrow: 'กฎหมาย',
    h1: 'เงื่อนไขการใช้บริการ',
    sub: 'ฉบับย่อสไตล์ "Premium Air" ฉบับเต็มของข้อตกลงผู้ใช้สามารถขอได้จากฝ่ายสนับสนุน',
    effectiveFrom: 'มีผลตั้งแต่ 1 กุมภาพันธ์ 2026',
    sections: [
      { n: '01', title: 'แพลตฟอร์มและบทบาท', body: [
        `${getSiteDisplayName()} เป็นแพลตฟอร์มเทคโนโลยีที่เชื่อมโยงเจ้าของที่พักกับแขก เราเป็นตัวกลางและไม่ใช่คู่สัญญาในข้อตกลงเช่าระหว่างทั้งสองฝ่าย`,
        'แพลตฟอร์มเปิดให้ผู้เช่า (แขก) และผู้ให้เช่า (พาร์ทเนอร์) แต่ละบทบาทมีสิทธิและหน้าที่ตามที่ระบุในข้อตกลงฉบับเต็ม',
      ] },
      { n: '02', title: 'การจองและการชำระเงิน', body: [
        'ราคาแสดงรวมค่าธรรมเนียมบริการของแพลตฟอร์ม ไม่มีค่าธรรมเนียมแฝง',
        'เงินจะถูกถือไว้ในบัญชีเอสโครว์ของแพลตฟอร์มและจะโอนให้พาร์ทเนอร์เมื่อแขกเช็คอินเรียบร้อย',
        'อัตราแลกเปลี่ยน (THB / USD / EUR / RUB / CNY) ถูกตรึง ณ เวลาที่ชำระเงินตามผู้ให้บริการอัตราภายนอก',
      ] },
      { n: '03', title: 'การคุ้มครองด้วยเอสโครว์', body: [
        'เงินของแขกจะถูกถือไว้จนกว่าจะยืนยันการเช็คอิน เพื่อปกป้องทั้งสองฝ่ายจากการฉ้อโกง',
        'ในกรณีที่ยืนยันได้ว่ามีการละเมิดจากพาร์ทเนอร์ (ไม่ตรง, เข้าไม่ได้) แขกจะได้รับเงินคืนเต็มจำนวนภายใน 14 วันทำการ',
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
    contactH2: 'ต้องการฉบับเต็ม?',
    contactSub: 'ขอ PDF ฉบับละเอียดหรือสอบถามข้อใด ๆ — เราตอบใน 4 ภาษา',
    helpLink: 'ศูนย์ช่วยเหลือ',
  },
}

export default function TermsContent() {
  const { language } = useI18n()
  const s = STR[language] || STR.ru

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-50/60 via-white to-amber-50/40 border-b border-slate-100">
        <div className="container mx-auto px-4 pt-24 sm:pt-28 pb-14 sm:pb-16 max-w-4xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
            <ScrollText className="h-3 w-3" />
            {s.eyebrow} · {getSiteDisplayName()}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 leading-[1.05] mb-5">
            {s.h1}
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">{s.sub}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">{s.effectiveFrom}</p>
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
                <span className="font-serif text-3xl sm:text-4xl font-semibold text-teal-600/80 tracking-tight">
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
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-[#006666] text-white shadow-[0_10px_28px_rgba(0,102,102,0.32)]">
            <Mail className="h-5 w-5" />
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 mb-3">
            {s.contactH2}
          </h2>
          <p className="text-slate-600 mb-7 max-w-xl mx-auto">{s.contactSub}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:legal@gostaylo.com"
              className="inline-flex items-center justify-center rounded-2xl bg-[#006666] px-7 py-4 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(0,102,102,0.32)] transition-all hover:bg-[#005555] active:scale-[0.98]"
            >
              legal@gostaylo.com
            </a>
            <Link
              href="/help"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-7 py-4 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-400 hover:text-teal-700"
            >
              {s.helpLink}
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
