# Concierge Drive → HTTPS media playbook (ADR-210 Slice 4)

**Audience:** ops / Concierge ingest.  
**Goal:** only put **direct HTTPS image URLs** into `listings.images` before or during ingest; Google Drive **folders** and **file/view** share links are **not** downloadable as image bytes.

Brand in partner-facing copy: **`getSiteDisplayName()`** / Airento — not GoStayLo.

---

## 1. What the platform accepts

| URL type | Ingest | Rehost |
|----------|--------|--------|
| `https://…jpg|png|webp` (CDN, hotel site, etc.) | ✅ stored on listing | ✅ downloaded → `listing-images/concierge/{listingId}/{hash}.{ext}` |
| Already on Supabase `listing-images` / `/_storage/…` | ✅ kept | skipped (already hosted) |
| `https://drive.google.com/drive/folders/…` | ⚠️ skipped + `metadata.media_warnings` (`DRIVE_FOLDER_OR_VIEW`) | skipped + warning |
| `https://drive.google.com/file/d/…/view` | ⚠️ skipped (same code) | skipped |
| `http://…` (non-TLS) | ⚠️ skipped (`NON_HTTPS_IMAGE`) | not rehosted as Concierge HTTPS rule |
| Drive `uc?export=download&id=…` | allowed as HTTPS string | may work if Google returns image MIME; prefer CDN rehost |

MIME for Concierge rehost allowlist: **jpeg / png / webp** only.

---

## 2. Ops workflow (Drive folder from partner)

1. Partner sends a **Drive folder** (typical rate-card package).
2. Ops opens the folder → select images → **Download** (or export as ZIP).
3. Upload files to a stable HTTPS host **you control**, e.g.:
   - temporary public CDN / object storage, **or**
   - upload via partner wizard / admin tooling into `listing-images`, then copy public `/_storage/…` URLs.
4. Put those **file** HTTPS URLs into the normalized ingest JSON `listings[].images[]`.
5. Call `POST /api/v2/admin/concierge/ingest` (`autoRehostMedia` defaults **true**) — platform pulls HTTPS → Supabase Storage under `concierge/{listing_id}/…` and replaces external URLs.
6. Optional retry / single listing:  
   `POST /api/v2/admin/concierge/rehost-media`  
   Body: `{ "batchId": "…" }` or `{ "listingId": "…" }` (`force: true` to re-scan).

Do **not** paste the folder share URL into `images[]` — the API will drop it and record `media_warnings` on the batch.

---

## 3. Checking warnings

- Batch row: `concierge_import_batches.metadata.media_warnings`
- Ingest API response: `mediaWarnings`
- Rehost API response: `mediaWarnings` / `errors` (per-URL failures keep the original URL; batch does not abort)

---

## 4. Non-goals (this slice)

- No automated Drive folder crawler / Google OAuth crawl.
- No Airbnb scrape.
- No R2 / Cloudflare Images for M2.0 — **Supabase `listing-images` only**.

---

## 5. Related code

- `lib/services/concierge/concierge-media.service.js`
- `lib/services/external-image-storage.js` (`pathMode: 'concierge'`)
- `POST /api/v2/admin/concierge/rehost-media`
- Ingest: `autoRehostMedia` (default true)
