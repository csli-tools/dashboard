# CSLI Dashboard - NEAR Data Models

## Overview

This document describes the data model architecture for the NEAR Protocol version of CSLI Dashboard. The models have been designed to be type-safe, comprehensive, and easy to use throughout the application.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NEAR RPC Responses                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   near-adapter.ts                            │
│              (Converts RPC → Data Models)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Data Models Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │ NEARTypes.ts │  │BlockDetails  │  │NEARTransaction │   │
│  │              │  │    .ts       │  │   Details.ts   │   │
│  └──────────────┘  └──────────────┘  └────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                UI Components (React)                         │
│         battle-station.tsx, panes/*, etc.                    │
└─────────────────────────────────────────────────────────────┘
```

## Core Files

### 1. `src/model/NEARTypes.ts`

**Purpose**: Complete NEAR Protocol type definitions

**Contains**:
- `NEARBlock` - Block structure with header and chunks
- `NEARTransaction` - Transaction with actions and signatures
- `NEARAction` - Union type for all 9 NEAR action types
- `NEARTransactionResult` - Full transaction execution results with receipts
- **16 utility functions** for formatting and parsing

**Key Types**:

```typescript
// Block with all metadata
interface NEARBlock {
  header: NEARBlockHeader;
  chunks: NEARChunkHeader[];
  transactions?: NEARTransaction[];
}

// Transaction
interface NEARTransaction {
  hash: string;
  signer_id: string;
  receiver_id: string;
  actions: NEARAction[];
  // ...
}

// Action types (discriminated union)
type NEARAction =
  | { CreateAccount: {} }
  | { Transfer: { deposit: string } }
  | { FunctionCall: { method_name: string; args: string; ... } }
  | { Delegate: { delegate_action: ...; signature: string } }
  // ... 5 more types
```

**Utility Functions**:

| Function | Purpose | Example |
|----------|---------|---------|
| `formatNEAR()` | Convert yoctoNEAR → NEAR | `"1000000000000000000000000"` → `"1.00"` |
| `nanosecToDate()` | Convert timestamp | `"1729819460917493664"` → `Date` |
| `getActionType()` | Extract action name | `{Transfer: {...}}` → `"Transfer"` |
| `getActionDescription()` | Human-readable text | → `"Transfer 1.00 NEAR"` |
| `decodeFunctionCallArgs()` | Parse base64 args | base64 → JSON object |
| `isTransactionSuccessful()` | Check success | `result` → `true/false` |

### 2. `src/model/BlockDetails.ts`

**Purpose**: Simplified block model for dashboard display

**Updated From Cosmos**:
```typescript
// OLD (Cosmos)
interface BlockDetails {
  height: number
  transactions: Uint8Array[]  // Raw bytes
}

// NEW (NEAR)
interface BlockDetails {
  height: number;
  hash: string;
  timestamp: number;
  transactions: NEARTransaction[];  // Parsed!
  chunks: Array<{ ... }>;
  // + 6 more fields
}
```

**Usage**:
```typescript
const block = await fetchLatestBlock();
console.log(`Block ${block.height} has ${block.transactions.length} txs`);
```

### 3. `src/model/NEARTransactionDetails.ts`

**Purpose**: Extended transaction model with execution results

**Combines**:
- Basic transaction data
- Execution outcomes
- Gas usage
- Logs and receipts
- Success/failure status

```typescript
interface NEARTransactionDetails {
  // Basic info
  hash: string;
  signer_id: string;
  receiver_id: string;

  // Execution results
  status?: 'pending' | 'success' | 'failed';
  gas_burnt?: number;
  logs?: string[];
  result?: any;        // Parsed success value
  error?: string;      // If failed

  // More details...
}
```

**Helper Functions**:
- `getTransactionSummary()` - One-line description
- `getStatusEmoji()` - ✅/❌/⏳
- `formatGas()` - Human-readable gas (e.g., "2.5 TGas")

### 4. `src/services/near-adapter.ts`

**Purpose**: Convert RPC responses to data models

**Key Functions**:

```typescript
// Fetch and convert blocks
async fetchLatestBlock(): Promise<BlockDetails>
async fetchBlockDetails(blockId): Promise<BlockDetails>

// Fetch and convert transactions
async fetchTransactionDetails(hash, accountId): Promise<NEARTransactionDetails>

// Utility conversions
convertBlockToDetails(nearBlock, transactions): BlockDetails
convertTransactionToDetails(tx): NEARTransactionDetails

// Filtering and analysis
getTransactionsForAccount(block, accountId): NEARTransaction[]
getTransactionsByActionType(block, type): NEARTransaction[]
calculateTPS(blocks): number
```

**Example Usage**:
```typescript
import { fetchLatestBlock, getTransactionsByActionType } from './services/near-adapter';

const block = await fetchLatestBlock();
const transfers = getTransactionsByActionType(block, 'Transfer');
console.log(`Found ${transfers.length} transfers`);
```

## Action Types

NEAR has 9 action types (Cosmos has ~50 message types):

| Action Type | Purpose | Example |
|-------------|---------|---------|
| **CreateAccount** | Create new account | `alice.near` creates `bob.alice.near` |
| **Transfer** | Send NEAR tokens | Send 5 NEAR to someone |
| **FunctionCall** | Call smart contract | `ft_transfer()` on token contract |
| **DeployContract** | Deploy contract code | Upload WASM |
| **AddKey** | Add access key | Add key for contract access |
| **DeleteKey** | Remove access key | Revoke access |
| **DeleteAccount** | Delete account | Close account, send remaining to beneficiary |
| **Stake** | Stake with validator | Stake 100 NEAR |
| **Delegate** | Delegate actions | Meta-transaction (used by relayers) |

## Data Flow Example

### Fetching Latest Block

```typescript
// 1. RPC Call
const rpcResponse = await sendRpc('block', { finality: 'final' });
// Returns: Raw NEAR RPC response

// 2. Fetch Transactions
const transactions = await getBlockTransactions(rpcResponse.result);
// Returns: Array of NEARTransaction

// 3. Convert to Model
const blockDetails = convertBlockToDetails(rpcResponse.result, transactions);
// Returns: BlockDetails

// 4. Use in UI
console.log(`Block ${blockDetails.height}`);
blockDetails.transactions.forEach(tx => {
  tx.actions.forEach(action => {
    console.log(getActionDescription(action));
  });
});
```

### Analyzing a Transaction

```typescript
// 1. Get transaction from block
const tx = blockDetails.transactions[0];

// 2. Convert to details
const details = convertTransactionToDetails(tx, blockDetails.height);

// 3. Display
console.log(getStatusEmoji(details.status), getTransactionSummary(details));
// Output: "⏳ alice.near → token.near: Call ft_transfer()"

// 4. Fetch full results (optional)
const fullDetails = await fetchTransactionDetails(tx.hash, tx.signer_id);
console.log(`Gas burnt: ${formatGas(fullDetails.gas_burnt!)}`);
// Output: "Gas burnt: 2.5 TGas"
```

## Helper Functions Reference

### Formatting Functions

```typescript
// Amount formatting
formatNEAR("1000000000000000000000000") → "1.00"
yoctoToNEAR("5000000000000000000000000") → 5.0

// Time formatting
nanosecToDate("1729819460917493664") → Date(2025-10-15...)
nanosecToMillisec("1729819460917493664") → 1729819460917

// Gas formatting
formatGas(2500000000000) → "2.50 TGas"
formatGas(5000000000) → "5.00 GGas"
```

### Parsing Functions

```typescript
// Decode function call arguments
const args = decodeFunctionCallArgs(base64String);
// Returns: { account_id: "alice.near", amount: "1000" }

// Decode transaction result
const result = decodeSuccessValue(base64Result);
// Returns: parsed JSON or string

// Get action info
getActionType(action) → "Transfer"
getActionDescription(action) → "Transfer 5.00 NEAR"
```

### Analysis Functions

```typescript
// Transaction status
isTransactionSuccessful(result) → true/false
getTransactionError(result) → "Error message" | null
getTotalGasBurnt(result) → 2500000000000

// Block analysis
calculateTPS([block1, block2, block3]) → 39.61
getBlockTime(block1, block2) → 0.62  // seconds
```

## Testing

Run comprehensive tests:

```bash
# Test RPC connection
npm run test:near

# Test data models
npm run test:models
```

**Test Coverage**:
- ✅ Block fetching and parsing
- ✅ Transaction extraction
- ✅ Action type parsing
- ✅ Formatting functions
- ✅ Filtering and analysis
- ✅ Multi-block TPS calculation
- ✅ Data integrity checks

**Latest Test Results** (mainnet):
```
✓ Block height: 168,333,107
✓ Transactions: 23 per block
✓ Action types: Delegate (87%), FunctionCall (13%)
✓ Average TPS: 39.61
✓ Block time: 0.6 seconds
✓ Timestamp accuracy: <1ms difference
```

## Migration from Cosmos

### Old Cosmos Model
```typescript
// Complex protobuf decoding
const txBytes = block.txs[0];
const decoded = decodeTxRaw(txBytes);
const msg = MsgExecuteContract.decode(decoded.body.messages[0].value);
```

### New NEAR Model
```typescript
// Already parsed!
const tx = block.transactions[0];
const action = tx.actions[0];
if ('FunctionCall' in action) {
  const args = decodeFunctionCallArgs(action.FunctionCall.args);
}
```

**Key Improvements**:
1. No protobuf decoding needed
2. Type-safe discriminated unions
3. Built-in utility functions
4. Comprehensive TypeScript types

## Next Steps

To use these models in the dashboard:

1. Update `battle-station.tsx` to use `fetchLatestBlock()`
2. Update block details pane to display `BlockDetails`
3. Update transaction panes to use `NEARTransactionDetails`
4. Replace Cosmos message decoding with NEAR action handling

See `MIGRATION-PLAN.md` for detailed migration steps.