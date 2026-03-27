/**
 * Мгновенный скелетон при переходе в тред (снижает ощущение «белого экрана»).
 */
export default function RenterMessageThreadLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col gap-3 p-4 animate-pulse" aria-busy="true" aria-label="Загрузка чата">
      <div className="h-10 rounded-lg bg-slate-200" />
      <div className="flex flex-1 flex-col gap-2 pt-4">
        <div className="h-12 max-w-[70%] rounded-2xl bg-slate-100" />
        <div className="h-12 max-w-[55%] self-end rounded-2xl bg-teal-100/80" />
        <div className="h-24 max-w-[85%] rounded-2xl bg-slate-100" />
        <div className="h-10 max-w-[40%] self-end rounded-2xl bg-teal-100/80" />
      </div>
    </div>
  )
}
