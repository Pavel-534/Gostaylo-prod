import { NextResponse } from 'next/server'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'

// Mock Trongrid API verification
// In production: Use real Trongrid API or Tatum API
async function verifyTronTransaction(txid, expectedAmount, targetWallet) {
  // Mock verification logic
  // Real API would be: https://api.trongrid.io/v1/transactions/{txid}
  
  console.log(`[TRON VERIFY] Checking TXID: ${txid}`)
  console.log(`[TRON VERIFY] Expected: ${expectedAmount} USDT to ${targetWallet}`)
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Mock blockchain response - simulate random received amount
  const receivedAmount = parseFloat(expectedAmount)
  
  // Mock verification result
  // In real app, parse blockchain response
  const mockResult = {
    success: true,
    txid: txid,
    confirmed: true,
    confirmations: 19,
    amount: receivedAmount,
    currency: 'USDT',
    from: 'TMockSenderAddress123',
    to: targetWallet,
    timestamp: new Date().toISOString(),
    blockNumber: 12345678,
  }
  
  // Validation logic
  if (mockResult.to !== targetWallet) {
    return { verified: false, error: 'Wrong destination wallet' }
  }
  
  // ⚠️ CRITICAL CHECK: Insufficient funds
  if (mockResult.amount < parseFloat(expectedAmount)) {
    return { 
      verified: false, 
      error: 'ERROR_INSUFFICIENT_FUNDS',
      errorMessage: `Получено ${mockResult.amount} USDT, требуется ${expectedAmount} USDT`,
      received: mockResult.amount,
      expected: parseFloat(expectedAmount),
    }
  }
  
  if (mockResult.confirmations < 19) {
    return { verified: false, error: 'Insufficient confirmations', confirmations: mockResult.confirmations }
  }
  
  return { verified: true, data: mockResult }
}

export async function POST(request) {
  try {
    let body
    try {
      body = await request.json()
    } catch (parseErr) {
      void notifySystemAlert(
        `🔌 <b>Webhook: crypto/confirm</b> — невалидный JSON\n<code>${escapeSystemAlertHtml(parseErr?.message || parseErr)}</code>`,
      )
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 },
      )
    }
    const { txid, bookingId, expectedAmount, targetWallet } = body
    
    if (!txid || !bookingId) {
      void notifySystemAlert(
        `🔌 <b>Webhook: crypto/confirm</b> — некорректное тело (нет txid/bookingId)\n<code>${escapeSystemAlertHtml(JSON.stringify(body).slice(0, 500))}</code>`,
      )
      return NextResponse.json(
        { success: false, error: 'Missing txid or bookingId' },
        { status: 400 }
      )
    }
    
    // Verify transaction on blockchain
    const verification = await verifyTronTransaction(txid, expectedAmount, targetWallet)
    
    if (!verification.verified) {
      return NextResponse.json({
        success: false,
        verified: false,
        error: verification.error,
        errorMessage: verification.errorMessage,
        received: verification.received,
        expected: verification.expected,
        confirmations: verification.confirmations || 0,
      })
    }
    
    // ✅ Transaction verified! Now update payment and booking via main API
    console.log(`[CRYPTO CONFIRM] ✅ Payment verified for booking ${bookingId}`)
    console.log(`[CRYPTO CONFIRM] TXID: ${txid}, Confirmations: ${verification.data.confirmations}`)
    
    // Call the main API to confirm payment
    // This will update mockDB: Payment→COMPLETED, Booking→PAID, add to escrow
    try {
      const confirmRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/bookings/${bookingId}/payment/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txId: txid,
          gatewayRef: `TRON-${verification.data.blockNumber}`,
        }),
      })
      
      const confirmData = await confirmRes.json()
      
      if (!confirmData.success) {
        console.error('[CRYPTO CONFIRM] Failed to update booking:', confirmData.error)
        void notifySystemAlert(
          `🔌 <b>Webhook: crypto/confirm</b> — верификация OK, бронь не обновилась\n` +
            `booking: <code>${escapeSystemAlertHtml(bookingId)}</code>\n` +
            `<code>${escapeSystemAlertHtml(String(confirmData.error || '').slice(0, 600))}</code>`,
        )
        return NextResponse.json({
          success: false,
          error: 'Payment verified but failed to update booking',
          details: confirmData.error,
        }, { status: 500 })
      }
      
      // Mock Telegram notification
      console.log(`[TELEGRAM] 💰 Крипто-платёж подтверждён для бронирования #${bookingId}!`)
      
      return NextResponse.json({
        success: true,
        verified: true,
        data: {
          txid,
          bookingId,
          confirmations: verification.data.confirmations,
          amount: verification.data.amount,
          timestamp: verification.data.timestamp,
          status: 'COMPLETED',
          booking: confirmData.data.booking,
          payment: confirmData.data.payment,
        },
        message: '✅ Crypto payment verified and booking updated!',
      })
      
    } catch (apiError) {
      console.error('[CRYPTO CONFIRM] API call error:', apiError)
      void notifySystemAlert(
        `🔌 <b>Webhook: crypto/confirm</b> — сбой вызова payment API\n` +
          `<code>${escapeSystemAlertHtml(apiError?.message || apiError)}</code>`,
      )
      return NextResponse.json({
        success: false,
        error: 'Failed to connect to payment API',
        details: apiError.message,
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('Crypto webhook error:', error)
    void notifySystemAlert(
      `🔌 <b>Webhook: crypto/confirm</b> — необработанная ошибка\n<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    )
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET method for testing
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Crypto verification webhook is active',
    info: {
      endpoint: 'POST /api/webhooks/crypto/confirm',
      required_fields: ['txid', 'bookingId', 'expectedAmount', 'targetWallet'],
      network: 'TRC-20 (Tron)',
      min_confirmations: 19,
    },
  })
}
