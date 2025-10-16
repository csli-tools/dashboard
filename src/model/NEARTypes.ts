// NEAR Protocol Type Definitions
// Based on NEAR RPC specification and nearcore implementation

// ============================================================================
// Block Types
// ============================================================================

export interface NEARBlockHeader {
  hash: string;
  height: number;
  prev_hash: string;
  timestamp: number; // Converted from nanoseconds to milliseconds
  timestamp_nanosec: string; // Original nanosecond timestamp
  epoch_id: string;
  next_epoch_id: string;
  gas_price: string;
  total_supply: string;
  latest_protocol_version: number;
  random_value: string;
  chunks_included: number;
  validator_proposals: any[];
  chunk_mask: boolean[];
  approvals: string[];
  signature: string;
  block_ordinal: number;
}

export interface NEARChunkHeader {
  chunk_hash: string;
  prev_block_hash: string;
  outcome_root: string;
  prev_state_root: string;
  encoded_merkle_root: string;
  encoded_length: number;
  height_created: number;
  height_included: number;
  shard_id: number;
  gas_used: number;
  gas_limit: number;
  rent_paid: string;
  validator_reward: string;
  balance_burnt: string;
  outgoing_receipts_root: string;
  tx_root: string;
  validator_proposals: any[];
  signature: string;
}

export interface NEARBlock {
  header: NEARBlockHeader;
  chunks: NEARChunkHeader[];
  // Extended with our fetched transactions
  transactions?: NEARTransaction[];
}

// ============================================================================
// Transaction Types
// ============================================================================

export type NEARAction =
  | { CreateAccount: {} }
  | { DeployContract: { code: string } }
  | { FunctionCall: { method_name: string; args: string; gas: number; deposit: string } }
  | { Transfer: { deposit: string } }
  | { Stake: { stake: string; public_key: string } }
  | { AddKey: { public_key: string; access_key: NEARAccessKey } }
  | { DeleteKey: { public_key: string } }
  | { DeleteAccount: { beneficiary_id: string } }
  | { Delegate: { delegate_action: NEARDelegateAction; signature: string } };

export interface NEARAccessKey {
  nonce: number;
  permission: "FullAccess" | {
    FunctionCall: {
      allowance?: string;
      receiver_id: string;
      method_names: string[];
    }
  };
}

export interface NEARDelegateAction {
  sender_id: string;
  receiver_id: string;
  actions: NEARAction[];
  nonce: number;
  max_block_height: number;
  public_key: string;
}

export interface NEARTransaction {
  hash: string;
  signer_id: string;
  receiver_id: string;
  public_key: string;
  nonce: number;
  actions: NEARAction[];
  signature: string;
  priority_fee?: number;
}

// ============================================================================
// Transaction Outcome Types
// ============================================================================

export interface NEARExecutionOutcome {
  executor_id: string;
  gas_burnt: number;
  logs: string[];
  receipt_ids: string[];
  status:
    | { SuccessValue: string }
    | { SuccessReceiptId: string }
    | { Failure: any };
  tokens_burnt: string;
  metadata?: {
    gas_profile?: any[];
    version: number;
  };
}

export interface NEARReceipt {
  predecessor_id: string;
  receiver_id: string;
  receipt_id: string;
  receipt:
    | { Action: { actions: NEARAction[]; gas_price: string; input_data_ids: string[]; output_data_receivers: any[]; signer_id: string; signer_public_key: string } }
    | { Data: { data_id: string; data: string } };
}

export interface NEARReceiptOutcome {
  block_hash: string;
  id: string;
  outcome: NEARExecutionOutcome;
  proof: any[];
}

export interface NEARTransactionResult {
  final_execution_status: "NONE" | "INCLUDED" | "EXECUTED_OPTIMISTIC" | "INCLUDED_FINAL" | "EXECUTED" | "FINAL";
  receipts: NEARReceipt[];
  receipts_outcome: NEARReceiptOutcome[];
  status:
    | { SuccessValue?: string }
    | { Failure?: any };
  transaction: NEARTransaction;
  transaction_outcome: NEARExecutionOutcome;
}

// ============================================================================
// Constants
// ============================================================================

/** 1 NEAR = 10^24 yoctoNEAR */
export const YOCTO_PER_NEAR = 1_000_000_000_000_000_000_000_000n;

/** 1 TGas = 10^12 gas units */
export const TERA_GAS = 1_000_000_000_000;

/** 1 GGas = 10^9 gas units */
export const GIGA_GAS = 1_000_000_000;

/** Conversion factor from nanoseconds to milliseconds */
export const NANOSEC_PER_MILLISEC = 1_000_000n;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract the action type name from a NEAR action
 */
export function getActionType(action: NEARAction): string {
  return Object.keys(action)[0];
}

/**
 * Get human-readable action description
 */
export function getActionDescription(action: NEARAction): string {
  const type = getActionType(action);
  const a = action as any;

  if (type === 'Transfer') {
    return `Transfer ${formatNEAR(a.Transfer.deposit)} NEAR`;
  }
  if (type === 'FunctionCall') {
    return `Call ${a.FunctionCall.method_name}()`;
  }
  if (type === 'CreateAccount') {
    return 'Create Account';
  }
  if (type === 'DeleteAccount') {
    return `Delete Account → ${a.DeleteAccount.beneficiary_id}`;
  }
  if (type === 'AddKey') {
    return 'Add Access Key';
  }
  if (type === 'DeleteKey') {
    return 'Delete Access Key';
  }
  if (type === 'DeployContract') {
    return 'Deploy Contract';
  }
  if (type === 'Stake') {
    return `Stake ${formatNEAR(a.Stake.stake)} NEAR`;
  }
  if (type === 'Delegate') {
    return 'Delegate Action';
  }
  return type;
}

/**
 * Format yoctoNEAR to NEAR (1 NEAR = 10^24 yoctoNEAR)
 * Uses BigInt throughout for precision
 */
export function formatNEAR(yoctoNEAR: string): string {
  try {
    const value = BigInt(yoctoNEAR);
    const whole = value / YOCTO_PER_NEAR;
    const fractional = value % YOCTO_PER_NEAR;

    // For very small amounts, use exponential notation
    if (whole === 0n && fractional < YOCTO_PER_NEAR / 100n) {
      const nearValue = Number(value) / Number(YOCTO_PER_NEAR);
      return nearValue.toExponential(2);
    }

    // Format with 2 decimal places
    const fractionalStr = fractional.toString().padStart(24, '0').slice(0, 2);
    return `${whole}.${fractionalStr}`;
  } catch (e) {
    return '0.00';
  }
}

/**
 * Parse yoctoNEAR to number (for small amounts)
 */
export function yoctoToNEAR(yoctoNEAR: string): number {
  try {
    return Number(BigInt(yoctoNEAR)) / 1e24;
  } catch (e) {
    return 0;
  }
}

/**
 * Format gas amount to human-readable string (TGas/GGas)
 */
export function formatGas(gas: number): string {
  if (gas >= TERA_GAS) {
    return `${(gas / TERA_GAS).toFixed(2)} TGas`;
  } else if (gas >= GIGA_GAS) {
    return `${(gas / GIGA_GAS).toFixed(2)} GGas`;
  } else {
    return `${gas} gas`;
  }
}

/**
 * Convert nanosecond timestamp to Date
 */
export function nanosecToDate(nanosec: string): Date {
  return new Date(Number(BigInt(nanosec) / NANOSEC_PER_MILLISEC));
}

/**
 * Convert nanosecond timestamp to milliseconds
 */
export function nanosecToMillisec(nanosec: string): number {
  return Number(BigInt(nanosec) / NANOSEC_PER_MILLISEC);
}

/**
 * Decode base64 args from FunctionCall
 */
export function decodeFunctionCallArgs(base64Args: string): any {
  try {
    const decoded = Buffer.from(base64Args, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    return base64Args; // Return raw if can't parse
  }
}

/**
 * Decode success value from transaction result
 */
export function decodeSuccessValue(base64Value: string): any {
  try {
    const decoded = Buffer.from(base64Value, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    // If parsing fails, try to return the decoded string, otherwise return original
    try {
      return Buffer.from(base64Value, 'base64').toString('utf-8');
    } catch {
      return base64Value;
    }
  }
}

/**
 * Recursively decode all FunctionCall args in a transaction's actions
 * This makes base64-encoded args human-readable in the UI
 */
export function decodeTransactionArgs(tx: NEARTransaction): NEARTransaction {
  // Deep clone to avoid mutating original
  const clonedTx = JSON.parse(JSON.stringify(tx));

  /**
   * Decode args in a single action
   */
  function decodeAction(action: NEARAction): NEARAction {
    const actionType = getActionType(action);

    // Decode FunctionCall args
    if (actionType === 'FunctionCall') {
      const fc = (action as any).FunctionCall;
      if (fc && fc.args) {
        try {
          const originalArgs = fc.args;
          fc.args = decodeFunctionCallArgs(fc.args);
          // Keep original base64 for reference (useful for debugging)
          fc.args_base64 = originalArgs;
        } catch (e) {
          fc.args = '[binary data]';
        }
      }
      return action;
    }

    // Recursively decode nested DelegateAction args
    if (actionType === 'Delegate') {
      const delegate = (action as any).Delegate;
      if (delegate && delegate.delegate_action && delegate.delegate_action.actions) {
        delegate.delegate_action.actions = delegate.delegate_action.actions.map(decodeAction);
      }
      return action;
    }

    return action;
  }

  // Decode all actions
  if (clonedTx.actions && Array.isArray(clonedTx.actions)) {
    clonedTx.actions = clonedTx.actions.map(decodeAction);
  }

  return clonedTx;
}

/**
 * Check if transaction was successful
 */
export function isTransactionSuccessful(result: NEARTransactionResult): boolean {
  return 'SuccessValue' in result.status || 'SuccessReceiptId' in result.status;
}

/**
 * Get transaction error message if failed
 */
export function getTransactionError(result: NEARTransactionResult): string | null {
  if ('Failure' in result.status) {
    return JSON.stringify(result.status.Failure, null, 2);
  }
  return null;
}

/**
 * Calculate total gas burnt from transaction result
 */
export function getTotalGasBurnt(result: NEARTransactionResult): number {
  let total = result.transaction_outcome.gas_burnt;

  result.receipts_outcome.forEach(ro => {
    total += ro.outcome.gas_burnt;
  });

  return total;
}

/**
 * Get all logs from transaction execution
 */
export function getAllLogs(result: NEARTransactionResult): string[] {
  const logs: string[] = [];

  // Add transaction outcome logs if available
  if (result.transaction_outcome?.logs && Array.isArray(result.transaction_outcome.logs)) {
    logs.push(...result.transaction_outcome.logs);
  }

  // Add receipt outcome logs if available
  if (result.receipts_outcome && Array.isArray(result.receipts_outcome)) {
    result.receipts_outcome.forEach(ro => {
      if (ro.outcome?.logs && Array.isArray(ro.outcome.logs)) {
        logs.push(...ro.outcome.logs);
      }
    });
  }

  return logs;
}