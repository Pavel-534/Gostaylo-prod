/**
 * Stage 202.52 — soft keep-in-view pan for catalog map listing popups (Leaflet _adjustPan math).
 * Pure helpers — no Leaflet import (unit-test friendly).
 */

/**
 * @typedef {{ top?: number, right?: number, bottom?: number, left?: number }} MapPopupPadding
 */

/**
 * Pixel panBy for Leaflet so a popup rectangle stays inside the map container.
 * Matches Leaflet Popup `_adjustPan` sign convention:
 * - positive x → pan map east (popup moves left in viewport)
 * - positive y → pan map south (popup moves up in viewport)
 *
 * @param {{
 *   mapWidth: number,
 *   mapHeight: number,
 *   popupLeft: number,
 *   popupTop: number,
 *   popupWidth: number,
 *   popupHeight: number,
 *   padding?: MapPopupPadding,
 *   minPanPx?: number,
 * }} args
 * @returns {{ x: number, y: number }}
 */
export function computeLeafletPopupKeepInViewPanBy(args) {
  const mapWidth = Number(args?.mapWidth)
  const mapHeight = Number(args?.mapHeight)
  const popupLeft = Number(args?.popupLeft)
  const popupTop = Number(args?.popupTop)
  const popupWidth = Number(args?.popupWidth)
  const popupHeight = Number(args?.popupHeight)
  if (
    ![mapWidth, mapHeight, popupLeft, popupTop, popupWidth, popupHeight].every(Number.isFinite) ||
    mapWidth <= 0 ||
    mapHeight <= 0 ||
    popupWidth <= 0 ||
    popupHeight <= 0
  ) {
    return { x: 0, y: 0 }
  }

  const pad = args?.padding || {}
  const padTop = Number.isFinite(pad.top) ? pad.top : 40
  const padRight = Number.isFinite(pad.right) ? pad.right : 40
  const padBottom = Number.isFinite(pad.bottom) ? pad.bottom : 40
  const padLeft = Number.isFinite(pad.left) ? pad.left : 40
  const minPan = Number.isFinite(args?.minPanPx) ? Math.max(0, args.minPanPx) : 8

  let dx = 0
  let dy = 0

  // Right overflow
  if (popupLeft + popupWidth + padRight > mapWidth) {
    dx = popupLeft + popupWidth + padRight - mapWidth
  }
  // Left overflow
  if (popupLeft - padLeft < 0) {
    dx = popupLeft - padLeft
  }

  // Bottom overflow
  if (popupTop + popupHeight + padBottom > mapHeight) {
    dy = popupTop + popupHeight + padBottom - mapHeight
  }
  // Top overflow
  if (popupTop - padTop < 0) {
    dy = popupTop - padTop
  }

  if (Math.abs(dx) < minPan) dx = 0
  if (Math.abs(dy) < minPan) dy = 0

  return { x: dx, y: dy }
}
