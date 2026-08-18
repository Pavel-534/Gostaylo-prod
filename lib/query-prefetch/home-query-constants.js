/** Client-safe home TanStack Query stale times (Stage 171.27 / 201.99). */

/** For You / featured — instant remount without network. Recently viewed lives on PDP only (201.107). */
export const HOME_WIDGET_STALE_MS = 10 * 60 * 1000

export const HOME_FEATURED_STALE_MS = HOME_WIDGET_STALE_MS

/** Per-widget overrides: do not inherit browser-tab focus refetch. */
export const HOME_WIDGET_QUERY_OPTIONS = {
  staleTime: HOME_WIDGET_STALE_MS,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
}
