/**
 * Stage 158 — map suggest API item → WhereCombobox option (client-safe, no server imports).
 */

/**
 * @param {{ value: string, type?: string, label: string, listing_count?: number, subtitle?: string, match_kind?: string, matched_term?: string, matched_synonym?: string, is_new?: boolean }} item
 */
export function suggestItemToWhereOption(item) {
  return {
    value: item.value,
    type: item.type === 'district' ? 'district' : 'city',
    label: item.label,
    listing_count: item.listing_count ?? 0,
    subtitle: item.subtitle,
    match_kind: item.match_kind,
    matched_term: item.matched_term,
    matched_synonym: item.matched_synonym,
    is_new: item.is_new === true,
    match: [String(item.value).toLowerCase(), String(item.label).toLowerCase()],
  }
}
