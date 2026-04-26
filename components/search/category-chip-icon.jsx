'use client'

/**
 * Stage 67–68 — Lucide icon for category chips / badges (wizard_profile SSOT + slug fallback).
 */

import {
  Layers,
  Home,
  Bike,
  Anchor,
  Map as MapIcon,
  Baby,
  UtensilsCrossed,
} from 'lucide-react'

/** @param {Record<string, unknown>} cat */
export function chipIconForCategory(cat) {
  const wp = String(cat.wizardProfile || cat.wizard_profile || '').toLowerCase().trim()
  if (wp === 'stay') return Home
  if (wp === 'transport' || wp === 'transport_helicopter') return Bike
  if (wp === 'yacht') return Anchor
  if (wp === 'tour') return MapIcon
  if (wp === 'nanny') return Baby
  if (wp === 'chef' || wp === 'massage' || wp === 'service_generic') return UtensilsCrossed
  const s = String(cat.slug || '').toLowerCase()
  if (['property', 'villa', 'apartment', 'house', 'condo', 'studio'].some((k) => s.includes(k))) return Home
  if (['vehicle', 'transport', 'bike', 'moto', 'car', 'helicopter'].some((k) => s.includes(k))) return Bike
  if (['yacht', 'boat', 'anchor'].some((k) => s.includes(k))) return Anchor
  if (['tour', 'trip', 'excursion'].some((k) => s.includes(k))) return MapIcon
  if (['nanny', 'babysitter', 'baby'].some((k) => s.includes(k))) return Baby
  if (['chef', 'cook', 'massage', 'service', 'spa'].some((k) => s.includes(k))) return UtensilsCrossed
  return Layers
}
