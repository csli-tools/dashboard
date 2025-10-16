import {
  NEARTransaction,
  NEARTransactionResult,
  NEARAction,
  getActionType,
  getActionDescription,
  isTransactionSuccessful,
  getTransactionError,
  getTotalGasBurnt,
  getAllLogs
} from './NEARTypes';

/**
 * Extended transaction details for display in the dashboard
 * Combines transaction data with execution results
 */
export interface NEARTransactionDetails {
  // Basic transaction info
  hash: string;
  block_height: number;
  signer_id: string;
  receiver_id: string;

  // Transaction details
  nonce: number;
  public_key: string;
  signature: string;
  actions: NEARAction[];

  // Execution results (if available)
  status?: 'pending' | 'success' | 'failed';
  final_execution_status?: string;

  // Outcomes
  gas_burnt?: number;
  tokens_burnt?: string;
  logs?: string[];

  // Result data
  result?: any; // Parsed success value or error
  error?: string;

  // Receipt information
  receipt_ids?: string[];
  receipts_count?: number;
}

/**
 * Convert a NEAR transaction to TransactionDetails for display
 */
export function createTransactionDetails(
  tx: NEARTransaction,
  blockHeight?: number,
  result?: NEARTransactionResult
): NEARTransactionDetails {

  const details: NEARTransactionDetails = {
    hash: tx.hash,
    block_height: blockHeight || 0,
    signer_id: tx.signer_id,
    receiver_id: tx.receiver_id,
    nonce: tx.nonce,
    public_key: tx.public_key,
    signature: tx.signature,
    actions: tx.actions,
  };

  // Add result information if available
  if (result) {
    details.status = isTransactionSuccessful(result) ? 'success' : 'failed';
    details.final_execution_status = result.final_execution_status;
    details.gas_burnt = getTotalGasBurnt(result);
    details.tokens_burnt = result.transaction_outcome.tokens_burnt;
    details.logs = getAllLogs(result);
    details.receipt_ids = result.transaction_outcome.receipt_ids;
    details.receipts_count = result.receipts.length;

    // Parse result or error
    if (isTransactionSuccessful(result)) {
      if ('SuccessValue' in result.status && result.status.SuccessValue) {
        try {
          const decoded = Buffer.from(result.status.SuccessValue, 'base64').toString('utf-8');
          details.result = decoded ? JSON.parse(decoded) : null;
        } catch (e) {
          details.result = result.status.SuccessValue;
        }
      }
    } else {
      details.error = getTransactionError(result) || 'Unknown error';
    }
  } else {
    details.status = 'pending';
  }

  return details;
}

/**
 * Get a summary string for the transaction
 */
export function getTransactionSummary(details: NEARTransactionDetails): string {
  const actionDescriptions = details.actions.map(getActionDescription);
  const actionStr = actionDescriptions.join(', ');

  return `${details.signer_id} → ${details.receiver_id}: ${actionStr}`;
}

/**
 * Get status emoji for display
 */
export function getStatusEmoji(status?: string): string {
  switch (status) {
    case 'success':
      return '✅';
    case 'failed':
      return '❌';
    case 'pending':
      return '⏳';
    default:
      return '❓';
  }
}

/**
 * Format gas burnt for display
 */
export function formatGas(gas: number): string {
  if (gas > 1e12) {
    return `${(gas / 1e12).toFixed(2)} TGas`;
  } else if (gas > 1e9) {
    return `${(gas / 1e9).toFixed(2)} GGas`;
  } else if (gas > 1e6) {
    return `${(gas / 1e6).toFixed(2)} MGas`;
  }
  return `${gas} Gas`;
}

export default NEARTransactionDetails;