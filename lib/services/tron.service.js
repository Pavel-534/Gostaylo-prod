/**
 * Gostaylo - TronScan Verification Service v2.0
 * Live verification of USDT TRC-20 transactions with FULL AMOUNT CHECK
 * 
 * API: https://apilist.tronscan.org/api/transaction-info?hash=[TXID]
 */

// Official Gostaylo USDT TRC-20 wallet
export const GOSTAYLO_WALLET = 'TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5';

// USDT TRC-20 Contract Address
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// THB to USDT exchange rate (should be fetched from API in production)
const THB_TO_USDT_RATE = 35.5;

// Tolerance for amount verification (0.5% margin - STRICT)
const AMOUNT_TOLERANCE = 0.005;

/**
 * Convert THB to USDT
 * @param {number} thbAmount - Amount in THB
 * @returns {number} Amount in USDT
 */
export function thbToUsdt(thbAmount) {
  return Math.round((thbAmount / THB_TO_USDT_RATE) * 100) / 100;
}

/**
 * Verify a TRON transaction with FULL AMOUNT verification
 * @param {string} txid - Transaction hash
 * @param {number} expectedAmountUsdt - Expected amount in USDT (optional)
 * @returns {Promise<{success: boolean, status: string, data?: object, error?: string}>}
 */
export async function verifyTronTransaction(txid, expectedAmountUsdt = null) {
  if (!txid || txid.length < 60) {
    return { 
      success: false, 
      status: 'INVALID', 
      error: 'Invalid TXID format' 
    };
  }

  try {
    // Fetch transaction info from TronScan API
    const response = await fetch(
      `https://apilist.tronscan.org/api/transaction-info?hash=${txid}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        // Timeout after 10 seconds
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      return { 
        success: false, 
        status: 'API_ERROR', 
        error: `TronScan API error: ${response.status}` 
      };
    }

    const data = await response.json();

    // Check if transaction exists
    if (!data || !data.hash) {
      return { 
        success: false, 
        status: 'NOT_FOUND', 
        error: 'Transaction not found on blockchain' 
      };
    }

    // Extract transaction details
    const txInfo = {
      hash: data.hash,
      confirmed: data.confirmed || false,
      block: data.block,
      timestamp: data.timestamp,
      ownerAddress: data.ownerAddress,
      toAddress: data.toAddress || data.contractData?.to_address,
      contractRet: data.contractRet,
      contractType: data.contractType,
      tokenInfo: null,
      amount: 0
    };

    // For TRC-20 transfers (USDT)
    if (data.contractType === 31 && data.trigger_info) {
      // TriggerSmartContract - TRC-20 transfer
      txInfo.tokenInfo = {
        symbol: data.trigger_info.tokenInfo?.tokenAbbr || 'USDT',
        decimals: data.trigger_info.tokenInfo?.tokenDecimal || 6,
        contract: data.trigger_info.contract_address
      };
      
      // Get transfer amount
      if (data.trigger_info.parameter?._value) {
        const rawAmount = BigInt(data.trigger_info.parameter._value);
        txInfo.amount = Number(rawAmount) / Math.pow(10, txInfo.tokenInfo.decimals);
      }
      
      // Get recipient from transfer parameters
      if (data.trigger_info.parameter?._to) {
        txInfo.toAddress = data.trigger_info.parameter._to;
      }
    }

    // Validate transaction
    const isConfirmed = txInfo.confirmed === true;
    const isSuccess = txInfo.contractRet === 'SUCCESS';
    const isToCorrectWallet = txInfo.toAddress?.toLowerCase() === GOSTAYLO_WALLET.toLowerCase();
    const isUSDT = txInfo.tokenInfo?.symbol === 'USDT' || 
                   txInfo.tokenInfo?.contract === USDT_CONTRACT;

    // FULL AMOUNT VERIFICATION
    let amountStatus = null;
    let amountDifference = 0;
    let amountPercentage = 100;

    if (expectedAmountUsdt !== null && txInfo.amount > 0) {
      amountDifference = txInfo.amount - expectedAmountUsdt;
      amountPercentage = (txInfo.amount / expectedAmountUsdt) * 100;
      
      const minAcceptable = expectedAmountUsdt * (1 - AMOUNT_TOLERANCE);
      
      if (txInfo.amount < minAcceptable) {
        amountStatus = 'UNDERPAID';
      } else if (txInfo.amount >= expectedAmountUsdt) {
        amountStatus = 'FULL';
      } else {
        amountStatus = 'ACCEPTABLE'; // Within tolerance
      }
    }

    // Determine final status
    let status = 'PENDING';
    if (!isConfirmed) {
      status = 'PENDING';
    } else if (!isSuccess) {
      status = 'FAILED';
    } else if (!isToCorrectWallet) {
      status = 'INVALID_RECIPIENT';
    } else if (!isUSDT) {
      status = 'WRONG_TOKEN';
    } else if (amountStatus === 'UNDERPAID') {
      status = 'UNDERPAID';
    } else {
      status = 'SUCCESS';
    }

    return {
      success: status === 'SUCCESS',
      status,
      data: {
        txid: txInfo.hash,
        confirmed: isConfirmed,
        block: txInfo.block,
        timestamp: txInfo.timestamp,
        from: txInfo.ownerAddress,
        to: txInfo.toAddress,
        amount: txInfo.amount,
        expectedAmount: expectedAmountUsdt,
        amountDifference: Math.round(amountDifference * 100) / 100,
        amountPercentage: Math.round(amountPercentage * 10) / 10,
        amountStatus,
        token: txInfo.tokenInfo?.symbol || 'TRX',
        isCorrectWallet: isToCorrectWallet,
        isCorrectToken: isUSDT,
        isAmountSufficient: amountStatus !== 'UNDERPAID',
        contractResult: txInfo.contractRet,
        tronscanUrl: `https://tronscan.org/#/transaction/${txid}`
      }
    };

  } catch (error) {
    console.error('[TRON VERIFY ERROR]', error);
    
    if (error.name === 'TimeoutError') {
      return { 
        success: false, 
        status: 'TIMEOUT', 
        error: 'TronScan API timeout' 
      };
    }
    
    return { 
      success: false, 
      status: 'ERROR', 
      error: error.message 
    };
  }
}

/**
 * Verify transaction with booking amount
 * @param {string} txid - Transaction hash
 * @param {number} bookingAmountThb - Booking amount in THB
 * @returns {Promise<object>} Verification result
 */
export async function verifyTransactionWithBooking(txid, bookingAmountThb) {
  const expectedUsdt = thbToUsdt(bookingAmountThb);
  return verifyTronTransaction(txid, expectedUsdt);
}

/**
 * Get status badge info for UI
 * @param {string} status - Transaction status
 * @returns {{label: string, labelRu: string, color: string, bgColor: string, icon: string}}
 */
export function getStatusBadge(status) {
  const badges = {
    SUCCESS: { 
      label: 'Verified', 
      labelRu: 'Подтверждён', 
      color: 'text-green-700', 
      bgColor: 'bg-green-100', 
      icon: '✓' 
    },
    PENDING: { 
      label: 'Pending', 
      labelRu: 'Ожидание', 
      color: 'text-yellow-700', 
      bgColor: 'bg-yellow-100', 
      icon: '⏳' 
    },
    NOT_FOUND: { 
      label: 'Not Found', 
      labelRu: 'Не найден', 
      color: 'text-red-700', 
      bgColor: 'bg-red-100', 
      icon: '✗' 
    },
    FAILED: { 
      label: 'Failed', 
      labelRu: 'Ошибка', 
      color: 'text-red-700', 
      bgColor: 'bg-red-100', 
      icon: '✗' 
    },
    INVALID_RECIPIENT: { 
      label: 'Wrong Wallet', 
      labelRu: 'Неверный получатель', 
      color: 'text-orange-700', 
      bgColor: 'bg-orange-100', 
      icon: '⚠' 
    },
    WRONG_WALLET: { 
      label: 'Wrong Wallet', 
      labelRu: 'Неверный кошелёк', 
      color: 'text-orange-700', 
      bgColor: 'bg-orange-100', 
      icon: '⚠' 
    },
    WRONG_TOKEN: { 
      label: 'Wrong Token', 
      labelRu: 'Неверный токен', 
      color: 'text-orange-700', 
      bgColor: 'bg-orange-100', 
      icon: '⚠' 
    },
    UNDERPAID: { 
      label: 'Underpaid', 
      labelRu: 'Недоплата', 
      color: 'text-red-700', 
      bgColor: 'bg-red-100', 
      icon: '💸' 
    },
    INVALID: { 
      label: 'Invalid', 
      labelRu: 'Неверный TXID', 
      color: 'text-gray-700', 
      bgColor: 'bg-gray-100', 
      icon: '?' 
    },
    API_ERROR: { 
      label: 'API Error', 
      labelRu: 'Ошибка API', 
      color: 'text-gray-700', 
      bgColor: 'bg-gray-100', 
      icon: '!' 
    },
    TIMEOUT: { 
      label: 'Timeout', 
      labelRu: 'Таймаут', 
      color: 'text-gray-700', 
      bgColor: 'bg-gray-100', 
      icon: '⏱' 
    },
    ERROR: { 
      label: 'Error', 
      labelRu: 'Ошибка', 
      color: 'text-red-700', 
      bgColor: 'bg-red-100', 
      icon: '✗' 
    }
  };
  
  return badges[status] || badges.ERROR;
}

/**
 * Generate TRON payment URI for QR code
 * @param {number} amountUsdt - Amount in USDT
 * @returns {string} Payment URI
 */
export function generateTronPaymentUri(amountUsdt = null) {
  // Standard TRON URI format for wallet apps
  // tron:[address]?amount=[value]&token=[contract]
  let uri = `tron:${GOSTAYLO_WALLET}`;
  
  if (amountUsdt) {
    // Add amount parameter for USDT
    uri += `?amount=${amountUsdt}&token=${USDT_CONTRACT}`;
  }
  
  return uri;
}

export default {
  verifyTronTransaction,
  verifyTransactionWithBooking,
  getStatusBadge,
  generateTronPaymentUri,
  thbToUsdt,
  GOSTAYLO_WALLET,
  THB_TO_USDT_RATE
};
