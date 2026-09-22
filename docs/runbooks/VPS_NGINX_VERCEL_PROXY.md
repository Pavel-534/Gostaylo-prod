# VPS nginx → Vercel proxy (airento.ru)

> Stage **202.49** audit notes. Config lives on the **RF VPS**, not in this repo.  
> App co-location: Vercel Functions **`sin1`** ↔ Supabase **`ap-southeast-1`** (Stage 202.48).

## What we verified from outside (2026-09-22)

| Check | Result |
|-------|--------|
| Edge | `Server: nginx/1.24.0 (Ubuntu)` on `https://airento.ru` |
| TLS ALPN | Node TLS client negotiated **`h2`** (HTTP/2 is enabled on the public listener) |
| Upstream region | `X-Vercel-Id: …::sin1::…` after Stage 202.48 |
| Keep-alive (browser↔nginx) | `Connection: keep-alive` on `/api/health` |
| Upstream keepalive → Vercel | **Confirmed by ops** (2026-09-22): Keep-Alive to Vercel enabled; `nginx -t` OK |

Outside probe could not SSH to the VPS; upstream keepalive is now **ops-confirmed** on the box (no further agent action).

## Recommended nginx snippet (ops)

Public HTTPS server (already serving airento.ru):

```nginx
listen 443 ssl http2;
# or: listen 443 ssl; http2 on;   # nginx ≥1.25.1 style
```

Upstream to Vercel (critical for TLS session reuse / ChunkLoadError hygiene — Stage 202.43):

```nginx
upstream vercel_airento {
  server <vercel-origin-or-cname>:443;
  keepalive 32;
}

server {
  # …
  location / {
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

    # Prefer keepalive-enabled upstream block above
    proxy_pass https://vercel_airento;

    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
  }

  # Static chunks — generous timeouts reduce Stage 202.43 Loading chunk failures
  location /_next/static/ {
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_pass https://vercel_airento;
    proxy_read_timeout 120s;
  }
}
```

### Ops checklist on VPS

1. `sudo nginx -T | grep -E 'listen|http2|proxy_http_version|keepalive|proxy_pass'`
2. Confirm **`http2`** on `listen 443`.
3. Confirm **`proxy_http_version 1.1;`** + **`proxy_set_header Connection "";`** on locations that proxy to Vercel.
4. Prefer an **`upstream { … keepalive N; }`** block over bare `proxy_pass https://….vercel.app` (each request otherwise may open a new TLS session).
5. `sudo nginx -t && sudo systemctl reload nginx`

## App-side rules (do not regress)

- Browser Supabase URL may use `https://airento.ru/supabase` (split URL).
- **`supabaseAdmin` / `SUPABASE_SERVER_URL` must hit `*.supabase.co` directly** — never via this VPS (`docs/runbooks/AUTH_GATEWAY_OAUTH.md`).
- Catalog ChunkLoadError resilience remains in app (Stage 202.43); nginx timeouts are still the first ops lever.

## Out of scope for Stage 202.49 code

Live nginx lives on the VPS. Upstream keepalive was **applied and verified by ops** (2026-09-22). Re-check only after proxy/nginx edits (`nginx -T` checklist above).
