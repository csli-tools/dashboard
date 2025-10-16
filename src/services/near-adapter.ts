/**
 * Adapter to convert NEAR RPC responses to our internal data models
 */

import BlockDetails from '../model/BlockDetails';
import { NEARTransaction, NEARBlock, nanosecToMillisec } from '../model/NEARTypes';
import { NEARTransactionDetails, createTransactionDetails } from '../model/NEARTransactionDetails';
import { getBlock, getBlockTransactions, getTransaction } from './near-rpc';

/**
 * Convert NEAR RPC block response to BlockDetails model
 */
export function convertBlockToDetails(nearBlock: any, transactions: NEARTransaction[]): BlockDetails {
  const header = nearBlock.header;

  return {
    height: header.height,
    hash: header.hash,
    timestamp: nanosecToMillisec(header.timestamp_nanosec),
    timestamp_nanosec: header.timestamp_nanosec,
    prev_hash: header.prev_hash,
    epoch_id: header.epoch_id,
    gas_price: header.gas_price,
    total_supply: header.total_supply,
    chunks_included: header.chunks_included,
    transactions: transactions,
    chunks: nearBlock.chunks.map((chunk: any) => ({
      chunk_hash: chunk.chunk_hash,
      shard_id: chunk.shard_id,
      gas_used: chunk.gas_used,
      gas_limit: chunk.gas_limit,
    }))
  };
}

/**
 * Fetch and convert a block by height or hash
 */
export async function fetchBlockDetails(blockId: number | string): Promise<BlockDetails> {
  // Fetch block
  const blockResponse = await getBlock({ block_id: blockId });
  const block = blockResponse.result;

  // Fetch all transactions from chunks
  const transactions = await getBlockTransactions(block);

  // Convert to our model
  return convertBlockToDetails(block, transactions);
}

/**
 * Fetch and convert the latest finalized block
 */
export async function fetchLatestBlock(): Promise<BlockDetails> {
  const blockResponse = await getBlock({ finality: 'final' });
  const block = blockResponse.result;

  const transactions = await getBlockTransactions(block);

  return convertBlockToDetails(block, transactions);
}

/**
 * Fetch transaction details with execution results
 */
export async function fetchTransactionDetails(
  txHash: string,
  accountId: string,
  blockHeight?: number
): Promise<NEARTransactionDetails> {
  try {
    // Try to get full transaction result
    const txResult = await getTransaction({
      tx_hash: txHash,
      sender_account_id: accountId,
      wait_until: 'FINAL'
    });

    return createTransactionDetails(
      txResult.result.transaction,
      blockHeight,
      txResult.result
    );
  } catch (error) {
    // If transaction details not available yet, return basic info
    // This happens for very recent transactions
    console.warn('Transaction details not yet available:', error);
    throw error;
  }
}

/**
 * Convert a simple NEAR transaction to transaction details (without execution results)
 */
export function convertTransactionToDetails(
  tx: NEARTransaction,
  blockHeight?: number
): NEARTransactionDetails {
  return createTransactionDetails(tx, blockHeight);
}

/**
 * Batch convert transactions to details
 */
export function convertTransactionsToDetails(
  transactions: NEARTransaction[],
  blockHeight?: number
): NEARTransactionDetails[] {
  return transactions.map(tx => convertTransactionToDetails(tx, blockHeight));
}

/**
 * Get transaction from block by hash
 */
export function findTransactionInBlock(
  blockDetails: BlockDetails,
  txHash: string
): NEARTransaction | undefined {
  return blockDetails.transactions.find(tx => tx.hash === txHash);
}

/**
 * Get transactions for a specific account from a block
 */
export function getTransactionsForAccount(
  blockDetails: BlockDetails,
  accountId: string
): NEARTransaction[] {
  return blockDetails.transactions.filter(
    tx => tx.signer_id === accountId || tx.receiver_id === accountId
  );
}

/**
 * Get transactions by action type from a block
 */
export function getTransactionsByActionType(
  blockDetails: BlockDetails,
  actionType: string
): NEARTransaction[] {
  return blockDetails.transactions.filter(tx =>
    tx.actions.some(action => Object.keys(action)[0] === actionType)
  );
}

/**
 * Calculate total transactions per second over multiple blocks
 */
export function calculateTPS(blocks: BlockDetails[]): number {
  if (blocks.length < 2) return 0;

  const totalTxs = blocks.reduce((sum, block) => sum + block.transactions.length, 0);
  const timeSpan = (blocks[0].timestamp - blocks[blocks.length - 1].timestamp) / 1000; // seconds

  return timeSpan > 0 ? totalTxs / timeSpan : 0;
}

/**
 * Get block production time (time between blocks)
 */
export function getBlockTime(currentBlock: BlockDetails, previousBlock: BlockDetails): number {
  return (currentBlock.timestamp - previousBlock.timestamp) / 1000; // seconds
}

export default {
  convertBlockToDetails,
  fetchBlockDetails,
  fetchLatestBlock,
  fetchTransactionDetails,
  convertTransactionToDetails,
  convertTransactionsToDetails,
  findTransactionInBlock,
  getTransactionsForAccount,
  getTransactionsByActionType,
  calculateTPS,
  getBlockTime,
};