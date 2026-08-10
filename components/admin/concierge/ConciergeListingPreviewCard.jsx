'use client'

/**
 * ADR-210 Slice 7 — preview card for Concierge validate payload.
 */

export function ConciergeListingPreviewCard({ listing }) {
  const seasons = Array.isArray(listing?.seasons) ? listing.seasons : []
  const images = Array.isArray(listing?.images) ? listing.images.slice(0, 4) : []
  const geo = listing?.geo || {}
  const geoLabel = [geo.addressText, geo.lat != null && geo.lng != null ? `${geo.lat}, ${geo.lng}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <article
      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
      data-testid={`concierge-preview-${listing?.externalId || 'item'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{listing?.title || '—'}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">ID: {listing?.externalId || '—'}</p>
        </div>
        <p className="text-sm font-medium text-brand">
          {Number.isFinite(Number(listing?.basePriceThb))
            ? `${Number(listing.basePriceThb).toLocaleString('ru-RU')} THB`
            : '— THB'}
        </p>
      </div>

      {geoLabel ? (
        <p className="mt-2 text-xs text-muted-foreground">Гео: {geoLabel}</p>
      ) : (
        <p className="mt-2 text-xs text-amber-700">Гео: координаты не указаны</p>
      )}

      {seasons.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-border/60 pt-2">
          {seasons.slice(0, 6).map((s, idx) => (
            <li key={`${s.startDate}-${idx}`} className="flex justify-between gap-2 text-xs">
              <span className="text-muted-foreground truncate">
                {s.label || s.seasonType || 'сезон'} · {s.startDate} → {s.endDate}
              </span>
              <span className="shrink-0 font-medium">{s.priceDaily} ฿/сут</span>
            </li>
          ))}
          {seasons.length > 6 ? (
            <li className="text-xs text-muted-foreground">+ ещё {seasons.length - 6}</li>
          ) : null}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Сезоны не заданы</p>
      )}

      {images.length > 0 ? (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {images.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              className="h-14 w-full rounded-md object-cover bg-muted"
              loading="lazy"
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-amber-700">Нет HTTPS-фото в пакете</p>
      )}
    </article>
  )
}
