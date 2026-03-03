/**
 * FunnyRent 2.1 - TronScan Verification Service
 * Live verification of USDT TRC-20 transactions
 * 
 * API: https://apilist.tronscan.org/api/transaction-info?hash=[TXID]
 */

// Official FunnyRent USDT TRC-20 wallet
export const FUNNYRENT_WALLET = 'TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5';

// USDT TRC-20 Contract Address
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

/**
 * Verify a TRON transaction
 * @param {string} txid - Transaction hash
 * @returns {Promise<{success: boolean, status: string, data?: object, error?: string}>}
 */
export async function verifyTronTransaction(txid) {
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
    const isToCorrectWallet = txInfo.toAddress?.toLowerCase() === FUNNYRENT_WALLET.toLowerCase();
    const isUSDT = txInfo.tokenInfo?.symbol === 'USDT' || 
                   txInfo.tokenInfo?.contract === USDT_CONTRACT;

    // Determine status
    let status = 'PENDING';
    if (!isConfirmed) {
      status = 'PENDING';
    } else if (!isSuccess) {
      status = 'FAILED';
    } else if (!isToCorrectWallet) {
      status = 'WRONG_WALLET';
    } else if (!isUSDT) {
      status = 'WRONG_TOKEN';
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
        token: txInfo.tokenInfo?.symbol || 'TRX',
        isCorrectWallet: isToCorrectWallet,
        isCorrectToken: isUSDT,
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
 * Get status badge info for UI
 * @param {string} status - Transaction status
 * @returns {{label: string, color: string, icon: string}}
 */
export function getStatusBadge(status) {
  const badges = {
    SUCCESS: { label: 'Подтверждён', color: 'green', icon: '✓' },
    PENDING: { label: 'Ожидание', color: 'yellow', icon: '⏳' },
    NOT_FOUND: { label: 'Не найден', color: 'red', icon: '✗' },
    FAILED: { label: 'Ошибка', color: 'red', icon: '✗' },
    WRONG_WALLET: { label: 'Неверный кошелёк', color: 'orange', icon: '⚠' },
    WRONG_TOKEN: { label: 'Неверный токен', color: 'orange', icon: '⚠' },
    INVALID: { label: 'Неверный TXID', color: 'gray', icon: '?' },
    API_ERROR: { label: 'Ошибка API', color: 'gray', icon: '!' },
    TIMEOUT: { label: 'Таймаут', color: 'gray', icon: '!' },
    ERROR: { label: 'Ошибка', color: 'red', icon: '✗' }
  };
  
  return badges[status] || badges.ERROR;
}

export default {
  verifyTronTransaction,
  getStatusBadge,
  FUNNYRENT_WALLET
};
