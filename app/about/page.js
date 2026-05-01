import { getSiteDisplayName } from '@/lib/site-url'

/**
 * /about — страница "О нас"
 * TODO: Добавить полноценный контент.
 */
export const metadata = {
  title: 'О нас | GoStaylo',
  description: 'GoStaylo — премиум-платформа аренды недвижимости, транспорта и яхт на Пхукете.',
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto px-4 pt-28 pb-20 max-w-3xl">
        <h1 className="text-4xl font-bold text-slate-900 mb-6">О нас</h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-4">
          GoStaylo — это премиум-платформа для аренды недвижимости, транспорта, яхт и экскурсий
          на Пхукете и других островах Таиланда.
        </p>
        <p className="text-lg text-slate-600 leading-relaxed mb-4">
          Мы объединяем проверенных арендодателей и арендаторов из всего мира, обеспечивая
          прозрачность, безопасность сделок и премиальный сервис.
        </p>
        <p className="text-lg text-slate-600 leading-relaxed">
          Наша миссия — сделать аренду на Пхукете такой же простой и надёжной,
          как заказ такси. Без посредников. Без скрытых комиссий.
        </p>
      </div>
    </main>
  )
}
