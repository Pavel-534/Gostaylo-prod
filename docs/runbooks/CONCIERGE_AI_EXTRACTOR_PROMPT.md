# Concierge AI Extractor Prompt (ADR-210 Slice 6)

**Audience:** ops / you as admin preparing ingest JSON.  
**Goal:** turn partner PDF / Excel / Google Sheet rate cards into JSON for:

1. `POST /api/v2/admin/concierge/validate-payload` (dry-run)  
2. `POST /api/v2/admin/concierge/ingest` (write drafts)

Brand in partner copy: **Airento** / `{brand}` — not GoStayLo.

---

## 1. Ops sequence

1. Export or paste the partner price list (text + table). Prefer **Sheet/Excel** over scanned PDF.
2. Paste the **system + user prompt** below into Grok / ChatGPT (or Cursor).
3. Ask the model for **JSON only** (no markdown fences if your tool forbids them).
4. Call **validate-payload** with `mappingProfile`:
   - `show_property_v1` — Phuket-style seasonal grids (high season required)
   - `generic_concierge_v1` — default / other formats
5. Fix errors from `summary.errors`, treat `warnings` (Drive links, missing coords, unreachable photos).
6. Materialize Drive folders → direct HTTPS images ([`CONCIERGE_DRIVE_MEDIA_PLAYBOOK.md`](./CONCIERGE_DRIVE_MEDIA_PLAYBOOK.md)).
7. Ingest with the same `listings` array (+ `partnerProfileId`, `sourceType`).

---

## 2. System prompt (copy)

```text
You convert vacation-rental / villa agent rate cards into a JSON package for the Airento Concierge ingest API.

Rules:
- Output ONE JSON object only. No commentary.
- Currency for money fields must be THB (Thai baht) as numbers in basePriceThb and seasons[].priceDaily.
  If the source is not THB, convert using rates I provide in the user message; if no rates given, keep original amount in a note field "needsCurrencyConversion" and still fill basePriceThb only when you can convert confidently.
- One inventory unit / room / villa code = one listing object (never merge units).
- seasons[] must use ISO dates YYYY-MM-DD (expand "Nov", "15 Dec–15 Jan", "High season" into concrete ranges for the season year I specify).
- price_monthly / monthly rates may be stored as seasons[].priceMonthly for notes only — daily priceDaily is mandatory for booking.
- images[]: only direct https:// image file URLs. Never Google Drive folder or /file/.../view share links.
- Do not invent fees, commission %, FX spreads, or ledger fields.
- categorySlug default "stay" unless clearly transport/tour.
- externalId: stable partner code (e.g. JU208). If missing, slug from title + building.

Schema:
{
  "mappingProfile": "show_property_v1" | "generic_concierge_v1",
  "sourceType": "pdf" | "xlsx" | "gsheet" | "json",
  "sourceLabel": "string",
  "listings": [
    {
      "externalId": "string",
      "title": "string",
      "description": "string",
      "categorySlug": "stay",
      "bedrooms": 1,
      "bathrooms": 1,
      "maxGuests": 2,
      "sqm": 40,
      "basePriceThb": 3300,
      "geo": {
        "lat": 7.88,
        "lng": 98.39,
        "addressText": "Kata, Phuket",
        "countryCode": "TH",
        "cityCode": "phuket"
      },
      "seasons": [
        {
          "startDate": "2026-12-15",
          "endDate": "2027-01-15",
          "priceDaily": 4500,
          "priceMonthly": 90000,
          "label": "High / 15 Dec–15 Jan",
          "seasonType": "high"
        }
      ],
      "images": ["https://cdn.example/a.jpg"],
      "amenities": ["wifi", "pool"],
      "icalUrl": "https://calendar.example/x.ics"
    }
  ]
}

For show_property_v1: every listing MUST include at least one season with seasonType "high" or label clearly marking high/peak season, with priceDaily > 0.
```

---

## 3. User prompt template (copy & fill)

```text
Season year to expand month headers: 2026–2027 (high season around mid-Dec to mid-Jan).
Preferred mappingProfile: show_property_v1
Optional FX (THB per 1 unit of foreign currency), only if needed: USD=… RUB=…

Source document / table:
---
<<PASTE RATE CARD TEXT OR CSV HERE>>
---

Also list any Google Maps links and Drive photo folders next to each unit if present.
Remember: Drive folders are NOT valid images[] entries — leave images[] empty or put only https file URLs.
```

---

## 4. Validate before ingest (example)

```http
POST /api/v2/admin/concierge/validate-payload
Content-Type: application/json

{
  "mappingProfile": "show_property_v1",
  "checkImageUrls": true,
  "listings": [ /* from AI */ ]
}
```

Expect `{ "success": true, "valid": true, "summary": { "totalListings", "totalSeasons", "warnings": [] } }`.

Then ingest the same `listings` with `partnerProfileId` and `sourceType`.

---

## 5. Related

- Profiles: `lib/services/concierge/mapping-profiles/`
- Drive photos: `CONCIERGE_DRIVE_MEDIA_PLAYBOOK.md`
- ADR: `docs/ADR/210-concierge-supply-pipeline.md`
