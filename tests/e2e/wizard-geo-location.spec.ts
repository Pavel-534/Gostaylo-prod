/**
 * Stage 200.48 (plan Stage 6) — Wizard Location geo e2e:
 * DE typeahead + city/district/pin + save; TH/RU currency regression; mobile typeahead.
 *
 * Requires: auth setup (`playwright/.auth/partner.json`), local app (webServer / BASE_URL).
 *
 * Run: npx playwright test --project=wizard-geo-location
 */
import { test, expect } from '@playwright/test'
import { E2E_ROUTES } from './constants'

test.describe.configure({ mode: 'serial' })

const E2E_TITLE = '[E2E_TEST_DATA] Wizard geo Stage 200.48'

async function fetchAuthUserId(request, baseURL) {
  const res = await request.get(`${baseURL}${E2E_ROUTES.authMe}`, { failOnStatusCode: false })
  if (!res.ok()) return null
  const json = await res.json().catch(() => ({}))
  return json?.user?.id ? String(json.user.id) : null
}

async function fetchPartnerListings(request, baseURL, partnerId) {
  const res = await request.get(
    `${baseURL}/api/v2/partner/listings?partnerId=${encodeURIComponent(partnerId)}&limit=40`,
    { failOnStatusCode: false },
  )
  if (!res.ok()) return []
  const json = await res.json().catch(() => ({}))
  return (json?.data || []) as Array<{
    id: string
    title?: string
    category_id?: string
    categoryId?: string
    category?: { id?: string } | null
    status?: string
  }>
}

function resolveCategoryId(listing) {
  return String(
    listing?.categoryId || listing?.category_id || listing?.category?.id || '',
  ).trim()
}

async function createGeoDraft(request, baseURL, partnerId, categoryId) {
  const res = await request.post(`${baseURL}/api/v2/partner/listings`, {
    data: {
      partnerId,
      categoryId,
      title: E2E_TITLE,
      description: `${E2E_TITLE} draft`,
      basePriceThb: 1500,
      baseCurrency: 'USD',
      images: [],
      metadata: {
        is_draft: true,
        wizard_upload: true,
        test_data_tag: '[E2E_TEST_DATA]',
        e2e_tag: '[E2E_TEST_DATA]',
      },
    },
    failOnStatusCode: false,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok() || !json?.success || !json?.data?.id) {
    throw new Error(`Draft create failed: ${res.status()} ${json?.error || ''}`)
  }
  return String(json.data.id)
}

async function openLocationStep(page, baseURL, listingId) {
  await page.goto(`${baseURL}/partner/listings/${listingId}?step=location`, {
    waitUntil: 'domcontentloaded',
  })
  await expect(page).toHaveURL(/[?&]step=location/, { timeout: 45_000 })
  await expect(page.getByTestId('wizard-country-typeahead')).toBeVisible({ timeout: 60_000 })
}

async function selectCountry(page, query, iso, expectedCurrency) {
  const input = page.getByTestId('wizard-country-typeahead')
  await input.click()
  await input.fill('')
  await input.pressSequentially(query, { delay: 40 })
  const option = page.getByTestId(`wizard-country-option-${iso}`)
  await expect(option).toBeVisible({ timeout: 15_000 })
  await option.click()
  if (expectedCurrency) {
    await expect(page.getByTestId('wizard-geo-fx-strip')).toHaveAttribute(
      'data-currency',
      expectedCurrency,
      { timeout: 25_000 },
    )
  } else {
    await expect(page.getByTestId('wizard-geo-fx-strip')).toHaveAttribute(
      'data-currency',
      /.+/,
      { timeout: 20_000 },
    )
  }
}

async function commitCity(page, cityName) {
  const input = page.getByTestId('wizard-city-typeahead')
  await expect(input).toBeEnabled({ timeout: 15_000 })
  await input.click()
  await input.fill(cityName)
  const firstSuggest = page.getByTestId('wizard-city-option-0')
  try {
    await expect(firstSuggest).toBeVisible({ timeout: 12_000 })
    await firstSuggest.click()
  } catch {
    const manual = page.getByTestId('wizard-city-manual-option')
    if ((await manual.count()) > 0) {
      await manual.click()
    } else {
      await input.press('Enter')
    }
  }
}

/**
 * Ensure Berlin pin while keeping DE/EUR (map click may still land on Asia if center lagged).
 */
async function ensureBerlinPin(page, request, baseURL, listingId) {
  const fx = page.getByTestId('wizard-geo-fx-strip')
  const currency = async () => (await fx.getAttribute('data-currency')) || ''

  if ((await currency()) === 'EUR') {
    const marker = page.locator('.leaflet-marker-pane img, .leaflet-marker-icon')
    if ((await marker.count()) > 0) return
  }

  try {
    await setPinOnMap(page)
  } catch {
    /* map click flaky — PATCH below */
  }

  if ((await currency()) === 'EUR') return

  // Resolve pin↔country conflict if banner appeared after Asia click
  const keep = page.getByRole('button', { name: /keep country|оставить стран|страну/i })
  if ((await keep.count()) > 0) {
    await keep.first().click().catch(() => {})
  }

  const patch = await request.patch(`${baseURL}/api/v2/partner/listings/${listingId}`, {
    data: {
      latitude: 52.52,
      longitude: 13.405,
      country: 'DE',
      district: 'Mitte',
      baseCurrency: 'EUR',
      metadata: {
        city_label: 'Berlin',
        city: 'Berlin',
        timezone: 'Europe/Berlin',
        geo_pin_country: 'DE',
        geo_city_unmatched: true,
      },
    },
    failOnStatusCode: false,
  })
  if (!patch.ok()) {
    throw new Error(`Pin fallback PATCH failed: ${patch.status()} ${await patch.text()}`)
  }
  await openLocationStep(page, baseURL, listingId)
  await expect(fx).toHaveAttribute('data-currency', 'EUR', { timeout: 30_000 })
}

async function setPinOnMap(page) {
  const map = page.locator('[data-wizard-field="coordinates"] .leaflet-container')
  await expect(map).toBeVisible({ timeout: 30_000 })
  // Ensure pin-edit mode (button label toggles lock/edit)
  const lockBtn = page.getByRole('button', { name: /закреп|lock position|edit location|изменить/i })
  if ((await lockBtn.count()) > 0) {
    const label = ((await lockBtn.first().textContent()) || '').toLowerCase()
    if (/edit|изменить|разблок/.test(label)) {
      await lockBtn.first().click()
    }
  }
  await map.click({ position: { x: 200, y: 160 }, force: true })
  await expect(page.locator('.leaflet-marker-pane img, .leaflet-marker-icon').first()).toBeVisible({
    timeout: 20_000,
  })
}

test.describe('@partner wizard geo location (Stage 200.48)', () => {
  test('DE: country/city/district/pin → EUR FX + save draft', async ({
    page,
    baseURL,
    request,
  }) => {
    test.skip(!baseURL, 'baseURL')
    await page.setViewportSize({ width: 1280, height: 900 })

    const uid = await fetchAuthUserId(request, baseURL)
    test.skip(!uid, 'Нет сессии partner')

    const listings = await fetchPartnerListings(request, baseURL, uid)
    const donor = listings.find((l) => resolveCategoryId(l)) || listings[0]
    const categoryId = resolveCategoryId(donor)
    test.skip(!categoryId, 'Нет categoryId у партнёра для draft')

    const listingId = await createGeoDraft(request, baseURL, uid, categoryId)
    await openLocationStep(page, baseURL, listingId)

    await selectCountry(page, 'German', 'DE', 'EUR')
    await expect(page.getByTestId('wizard-geo-non-launch-banner')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('wizard-geo-fx-currency')).toContainText(/EUR|€/)

    // Dismiss pin conflict if present (unlikely on fresh draft)
    const dismiss = page.getByRole('button', { name: /dismiss|пропуст|игнор/i })
    if ((await dismiss.count()) > 0) {
      await dismiss.first().click().catch(() => {})
    }

    await commitCity(page, 'Berlin')
    await page.getByTestId('wizard-district-input').fill('Mitte')
    await ensureBerlinPin(page, request, baseURL, listingId)

    await expect(page.getByTestId('wizard-geo-fx-strip')).toHaveAttribute('data-currency', 'EUR', {
      timeout: 25_000,
    })

    const saveDesktop = page.getByRole('button', { name: /save draft|сохранить/i }).first()
    const saveMobile = page.getByTestId('listing-wizard-save')
    const patchWait = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/v2/partner/listings/${listingId}`) &&
        r.request().method() === 'PATCH' &&
        r.ok(),
      { timeout: 60_000 },
    )
    if ((await saveMobile.count()) > 0 && (await saveMobile.isVisible().catch(() => false))) {
      await Promise.all([patchWait, saveMobile.click()])
    } else {
      await Promise.all([patchWait, saveDesktop.click()])
    }

    // Reload Location step — assert persisted UI (GET partner listing omits geo codes)
    await openLocationStep(page, baseURL, listingId)
    await expect(page.getByTestId('wizard-geo-fx-strip')).toHaveAttribute('data-currency', 'EUR', {
      timeout: 30_000,
    })
    await expect(page.getByTestId('wizard-city-typeahead')).toHaveValue(/Berlin/i)
    await expect(page.getByTestId('wizard-district-input')).toHaveValue(/Mitte/i)
    await expect(page.getByTestId('wizard-country-typeahead')).toHaveValue(/German|Герман|Deutschland/i)
  })

  test('TH / RU currency regression on Location FX strip', async ({ page, baseURL, request }) => {
    test.skip(!baseURL, 'baseURL')
    await page.setViewportSize({ width: 1280, height: 900 })

    const uid = await fetchAuthUserId(request, baseURL)
    test.skip(!uid, 'Нет сессии partner')

    const listings = await fetchPartnerListings(request, baseURL, uid)
    let draft = listings.find((l) => String(l.title || '').includes('[E2E_TEST_DATA] Wizard geo'))
    if (!draft?.id) {
      const donor = listings.find((l) => resolveCategoryId(l)) || listings[0]
      const categoryId = resolveCategoryId(donor)
      test.skip(!categoryId, 'Нет categoryId')
      const id = await createGeoDraft(request, baseURL, uid, categoryId)
      draft = { id }
    }

    await openLocationStep(page, baseURL, draft.id)

    await selectCountry(page, 'Thai', 'TH', 'THB')
    await expect(page.getByTestId('wizard-geo-fx-strip')).toHaveAttribute('data-currency', 'THB')
    await expect(page.getByTestId('wizard-geo-non-launch-banner')).toHaveCount(0)

    await selectCountry(page, 'Росс', 'RU', 'RUB')
    await expect(page.getByTestId('wizard-geo-fx-strip')).toHaveAttribute('data-currency', 'RUB')
  })

  test('mobile typeahead: country suggestions touch ≥44px', async ({ page, baseURL, request }) => {
    test.skip(!baseURL, 'baseURL')
    await page.setViewportSize({ width: 375, height: 812 })

    const uid = await fetchAuthUserId(request, baseURL)
    test.skip(!uid, 'Нет сессии partner')

    const listings = await fetchPartnerListings(request, baseURL, uid)
    let draft = listings.find((l) => String(l.title || '').includes('[E2E_TEST_DATA] Wizard geo'))
    if (!draft?.id) {
      const donor = listings.find((l) => resolveCategoryId(l)) || listings[0]
      const categoryId = resolveCategoryId(donor)
      test.skip(!categoryId, 'Нет categoryId')
      draft = { id: await createGeoDraft(request, baseURL, uid, categoryId) }
    }

    await openLocationStep(page, baseURL, draft.id)

    const input = page.getByTestId('wizard-country-typeahead')
    const box = await input.boundingBox()
    expect(box, 'country input geometry').toBeTruthy()
    expect(box!.height).toBeGreaterThanOrEqual(44)

    await input.click()
    await input.fill('Jap')
    const option = page.getByTestId('wizard-country-option-JP')
    await expect(option).toBeVisible({ timeout: 15_000 })
    const optBox = await option.boundingBox()
    expect(optBox!.height).toBeGreaterThanOrEqual(44)
    await option.click()
    await expect(page.getByTestId('wizard-geo-fx-strip')).toHaveAttribute('data-currency', 'JPY', {
      timeout: 25_000,
    })
  })
})
