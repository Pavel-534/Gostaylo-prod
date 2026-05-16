# Production environment — financial soft launch

Set in **Vercel → Project → Settings → Environment Variables** (Production).

## Required (financial)

| Variable | Production value | Notes |
|----------|------------------|--------|
| `CRON_SECRET` | long random string | Same value in cron-job.org headers |
| `PRICING_ENGINE_V2` | `true` | 1 THB rounding + snapshot v2 |
| `FISCAL_SANDBOX` | `false` | Real OFD receipts |
| `FISCAL_PROVIDER_URL` | prod OFD endpoint | From your касса provider |
| `FISCAL_KG_SUPPLIER_NAME` | ОсОО legal name | 54-FZ supplier tag |
| `FISCAL_RU_AGENT_INN` | RU agent INN | transit agent_sign=5 |

## Verify after deploy

```bash
curl -s https://<domain>/api/v2/pricing/engine-config | jq .data.roundingMode
# expect: "integer"
```

```bash
CRON_SECRET=... BASE_URL=https://<domain> EXPECT_PRICING_V2=true \
  node scripts/financial-prelaunch-smoke.mjs
```

## Optional alignment

| Variable | Notes |
|----------|--------|
| `system_settings.general.pricingEngineV2Enabled` | Should match `PRICING_ENGINE_V2` (admin settings) |

## Staging vs prod

| Variable | Staging | Production |
|----------|---------|------------|
| `FISCAL_SANDBOX` | `true` | `false` |
| `PRICING_ENGINE_V2` | `true` | `true` |

## Cron

Do **not** add hourly crons to `vercel.json` on **Hobby** — see [`docs/CRON_EXTERNAL_FINANCIAL.md`](./CRON_EXTERNAL_FINANCIAL.md).
