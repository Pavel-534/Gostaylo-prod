'use client'

/**
 * Loading placeholder for dynamically imported admin chart panels (recharts).
 * @param {{ className?: string }} props
 */
export function ChartSkeleton({ className = '' }) {
  return (
    <div
      className={`w-full min-h-[240px] rounded-2xl border border-slate-200 bg-slate-50 gsl-shimmer animate-pulse ${className}`}
      role="status"
      aria-label="Loading chart"
    />
  )
}

/** Shared `next/dynamic` options for admin recharts panels. */
export function adminChartDynamicOptions(extraClassName = '') {
  return {
    ssr: false,
    loading: () => <ChartSkeleton className={extraClassName} />,
  }
}

export default ChartSkeleton
