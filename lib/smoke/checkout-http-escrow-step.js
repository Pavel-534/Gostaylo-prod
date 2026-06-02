/**

 * Stage 124.19 — smoke: HTTP checkout initiate → mock acquiring webhook → PAID_ESCROW.

 */

import { supabaseAdmin } from '@/lib/supabase'

import {

  buildYookassaMirWebhookPayload,

  runAcquiringInitiateAndWebhook,

  resolveWebhookSecretForSmoke,

  SMOKE_WEBHOOK_DEV_SECRET,

} from '@/lib/smoke/checkout-acquiring-smoke-shared.js'



export { SMOKE_WEBHOOK_DEV_SECRET, resolveWebhookSecretForSmoke }



/**

 * @param {{

 *   bookingId: string,

 *   guestId: string,

 *   guestTotalThb: number,

 *   method?: 'MIR' | 'CARD',

 * }} params

 */

export async function runCheckoutHttpEscrowStep({

  bookingId,

  guestId,

  guestTotalThb,

  method = 'CARD',

}) {

  const flow = await runAcquiringInitiateAndWebhook({

    bookingId,

    guestId,

    method,

    adapterHeader: 'MIR_RU',

    buildWebhookPayload: ({ bookingId: bid, intentId }) =>

      buildYookassaMirWebhookPayload({

        bookingId: bid,

        intentId,

        amount: guestTotalThb,

        currency: 'THB',

      }),

  })



  if (!flow.ok) return flow



  const { data: finalRow, error: finErr } = await supabaseAdmin

    .from('bookings')

    .select('status, partner_earnings_thb')

    .eq('id', bookingId)

    .maybeSingle()



  if (finErr) return { ok: false, error: finErr.message }

  if (String(finalRow?.status || '').toUpperCase() !== 'PAID_ESCROW') {

    return { ok: false, error: `after webhook expected PAID_ESCROW, got ${finalRow?.status}` }

  }



  return {

    ok: true,

    detail: `HTTP initiate (${method}) → webhook → PAID_ESCROW (intent ${String(flow.intentId).slice(0, 14)}…)`,

    intentId: flow.intentId,

  }

}

