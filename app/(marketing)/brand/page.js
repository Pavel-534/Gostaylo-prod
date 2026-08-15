/**
 * Brand book — Airento visual identity guidelines.
 * Static server component. References brand assets in /public.
 * Route: /brand
 */

export const metadata = {
  title: 'Brand — Airento',
  description: 'Airento brand guidelines: logo, clear space, colors and usage.',
  robots: { index: false, follow: false },
}

const COLORS = [
  { name: 'Brand Teal', hex: '#0d9488', note: 'Primary • wordmark, links, accents', dark: true },
  { name: 'Deep Teal', hex: '#0a5c56', note: 'Gradient end • depth', dark: true },
  { name: 'Ribbon Slate', hex: '#64748b', note: 'Secondary mark • ribbon', dark: true },
  { name: 'Ink Navy', hex: '#0f172a', note: 'Dark surfaces • splash, OG', dark: true },
  { name: 'Mist', hex: '#eafcfa', note: 'Light icon background', dark: false },
  { name: 'Paper', hex: '#ffffff', note: 'Base surface', dark: false },
]

function Section({ title, subtitle, children }) {
  return (
    <section className="border-t border-slate-200 py-14">
      <h2 className="text-2xl font-black tracking-tight text-slate-900">{title}</h2>
      {subtitle ? <p className="mt-1 max-w-2xl text-slate-500">{subtitle}</p> : null}
      <div className="mt-8">{children}</div>
    </section>
  )
}

export default function BrandPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {/* Hero */}
      <header className="flex flex-col items-start gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/airento-lockup.svg" alt="Airento" className="h-16 w-auto" />
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Brand Guidelines</h1>
          <p className="mt-2 max-w-2xl text-lg text-slate-500">
            The Airento mark, wordmark, colors and rules that keep the identity crisp and premium
            across every screen — from a 16px browser tab to an App Store icon.
          </p>
        </div>
      </header>

      {/* The mark */}
      <Section
        title="The mark"
        subtitle="A stylized “A” interwoven with an infinity ribbon — endless, cross-border stays, built on trust. Vector master: airento-mark.svg."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex h-64 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/airento-mark.svg" alt="Airento mark on light" className="h-32 w-auto" />
          </div>
          <div className="flex h-64 items-center justify-center rounded-2xl bg-[#0f172a]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/airento-mark-light.svg" alt="Airento mark on dark" className="h-32 w-auto" />
          </div>
        </div>
      </Section>

      {/* Lockup */}
      <Section
        title="Horizontal lockup"
        subtitle="Mark + wordmark. Use the light lockup on light backgrounds and the white lockup on dark."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex h-40 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200 px-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/airento-lockup.svg" alt="Airento lockup light" className="max-h-20 w-auto" />
          </div>
          <div className="flex h-40 items-center justify-center rounded-2xl bg-[#0f172a] px-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/airento-lockup-onbg.svg" alt="Airento lockup dark" className="max-h-20 w-auto" />
          </div>
        </div>
      </Section>

      {/* Clear space & min size */}
      <Section
        title="Clear space & minimum size"
        subtitle="Keep breathing room around the mark equal to the height of the ribbon loop. Don’t crowd it."
      >
        <div className="flex flex-wrap items-end gap-10 rounded-2xl bg-white p-8 ring-1 ring-slate-200">
          {[24, 40, 64, 96].map((h) => (
            <div key={h} className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/airento-mark.svg" alt={`mark ${h}px`} style={{ height: h }} className="w-auto" />
              <span className="text-xs text-slate-400">{h}px</span>
            </div>
          ))}
          <p className="text-sm text-slate-500">
            For sizes below ~24px use the simplified favicon glyph (a bold “A”), not the full mark.
          </p>
        </div>
      </Section>

      {/* Favicon */}
      <Section
        title="Favicon / tiny sizes"
        subtitle="At 16–24px the full mark blurs, so a dedicated simplified glyph keeps the tab crisp."
      >
        <div className="flex items-center gap-8 rounded-2xl bg-white p-8 ring-1 ring-slate-200">
          {[16, 24, 32, 48].map((h) => (
            <div key={h} className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/favicon.svg" alt={`favicon ${h}px`} style={{ height: h, width: h }} />
              <span className="text-xs text-slate-400">{h}px</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Colors */}
      <Section title="Color palette" subtitle="Brand teal leads; navy anchors dark surfaces.">
        <div className="grid gap-4 sm:grid-cols-3">
          {COLORS.map((c) => (
            <div key={c.hex} className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
              <div className="h-24" style={{ background: c.hex }} />
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{c.name}</span>
                  <span className="font-mono text-xs uppercase text-slate-500">{c.hex}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{c.note}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Icon system */}
      <Section title="App icon system" subtitle="Full-bleed, no inner plate. Maskable keeps a safe zone for Android.">
        <div className="flex flex-wrap items-center gap-8">
          {[
            { src: '/icons/icon-512x512.png', label: 'App icon (light)' },
            { src: '/icons/icon-maskable-512x512.png', label: 'Maskable' },
            { src: '/icons/icon-dark-512x512.png', label: 'App icon (dark)' },
          ].map((i) => (
            <div key={i.src} className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.src} alt={i.label} className="h-28 w-28 rounded-[22%] ring-1 ring-slate-200" />
              <span className="text-xs text-slate-400">{i.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Do / Don't */}
      <Section title="Do & Don’t">
        <div className="grid gap-6 sm:grid-cols-2">
          <ul className="space-y-2 rounded-2xl bg-emerald-50 p-6 text-sm text-emerald-900 ring-1 ring-emerald-200">
            <li>✓ Use the vector master (SVG) whenever possible</li>
            <li>✓ Keep generous clear space around the mark</li>
            <li>✓ Use the white lockup on dark backgrounds</li>
            <li>✓ Use the simplified glyph below ~24px</li>
          </ul>
          <ul className="space-y-2 rounded-2xl bg-rose-50 p-6 text-sm text-rose-900 ring-1 ring-rose-200">
            <li>✕ Don’t place the mark inside a boxed plate/frame</li>
            <li>✕ Don’t recolor the gradient or stretch the mark</li>
            <li>✕ Don’t add drop shadows or outlines</li>
            <li>✕ Don’t use the full mark as a 16px favicon</li>
          </ul>
        </div>
      </Section>

      {/* Downloads */}
      <Section title="Assets">
        <div className="flex flex-wrap gap-3">
          {[
            ['Mark (SVG)', '/brand/airento-mark.svg'],
            ['Lockup light (SVG)', '/brand/airento-lockup.svg'],
            ['Lockup dark (SVG)', '/brand/airento-lockup-onbg.svg'],
            ['Lockup light (PNG)', '/brand/airento-lockup.png'],
            ['App icon 1024', '/icons/icon-1024x1024.png'],
            ['OG image', '/og-image.jpg'],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              download
            >
              {label}
            </a>
          ))}
        </div>
      </Section>
    </main>
  )
}
