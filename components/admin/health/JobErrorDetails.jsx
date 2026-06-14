'use client'

/**
 * Stage 142 — expandable monospace error block for ops_job_runs failures.
 */
export function JobErrorDetails({ preview, message, label = 'Текст ошибки' }) {
  const full = message || preview
  if (!full) return null

  const previewText = preview || (full.length > 160 ? `${full.slice(0, 160)}…` : full)

  return (
    <details className="mt-2 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2 text-xs">
      <summary className="cursor-pointer select-none text-red-800 font-medium list-none [&::-webkit-details-marker]:hidden">
        <span className="underline-offset-2 hover:underline">{label}</span>
        <span className="ml-2 font-normal text-red-700/90">{previewText}</span>
      </summary>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-red-900/90">
        {full}
      </pre>
    </details>
  )
}

/**
 * @param {{ jobName: string, status?: string | null, startedAt?: string | null, errorPreview?: string | null, errorMessage?: string | null }} failure
 */
export function OpsJobFailureRow({ failure }) {
  if (!failure?.errorMessage && !failure?.errorPreview) return null
  return (
    <li className="rounded-xl border border-amber-100 bg-white/80 px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
        <span className="font-mono font-medium text-slate-800">{failure.jobName}</span>
        <span className="text-slate-400">{failure.status || '—'}</span>
        {failure.startedAt ? (
          <span className="text-slate-500">{new Date(failure.startedAt).toLocaleString('ru-RU')}</span>
        ) : null}
      </div>
      <JobErrorDetails
        preview={failure.errorPreview}
        message={failure.errorMessage}
        label="Ошибка прогона"
      />
    </li>
  )
}
