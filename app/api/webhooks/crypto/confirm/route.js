import { NextResponse } from 'next/server'

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
    const body = await request.json()
    const { txid, bookingId, expectedAmount, targetWallet } = body
    
    if (!txid || !bookingId) {
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
        return NextResponse.json({
          success: false,
          error: 'Payment verified but failed to update booking',
          details: confirmData.error,
        }, { status: 500 })
      }
      
      // Send automated confirmation message to conversation
      const booking = confirmData.data.booking
      const listingId = booking?.listingId
      
      if (listingId) {
        // Send system message to chat
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: `conv-${listingId}-${booking.renterId}`,
            senderId: 'system',
            senderRole: 'SYSTEM',
            message: `✅ Крипто-платёж подтверждён! TXID: ${txid.slice(0, 20)}... | Статус бронирования: ОПЛАЧЕНО`,
            type: 'PAYMENT_CONFIRMED',
            metadata: {
              txid,
              amount: verification.data.amount,
              confirmations: verification.data.confirmations,
            },
          }),
        }).catch(err => console.log('[CRYPTO] Failed to send chat message:', err.message))
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
      return NextResponse.json({
        success: false,
        error: 'Failed to connect to payment API',
        details: apiError.message,
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('Crypto webhook error:', error)
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
