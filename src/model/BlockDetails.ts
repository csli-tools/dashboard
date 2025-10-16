import { NEARTransaction } from './NEARTypes';

// Updated for NEAR Protocol
export default interface BlockDetails {
  height: number;
  hash: string;
  timestamp: number; // milliseconds
  timestamp_nanosec: string; // original nanosecond timestamp
  prev_hash: string;
  epoch_id: string;
  gas_price: string;
  total_supply: string;
  chunks_included: number;
  transactions: NEARTransaction[];
  // Chunk information
  chunks: Array<{
    chunk_hash: string;
    shard_id: number;
    gas_used: number;
    gas_limit: number;
  }>;
}
