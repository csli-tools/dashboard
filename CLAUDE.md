# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CSLI Dashboard is a terminal-based block explorer and development tool for NEAR Protocol. It provides real-time monitoring of blockchain activity through a React-based terminal UI using the blessed library.

**Migration Status**: Migrated from Cosmos/CosmWasm to NEAR Protocol (October 2025). Core infrastructure complete, UI components pending update.

## Common Development Commands

```bash
# Start the main dashboard
npm run start

# Test NEAR connection and data models
npm run test:near      # Test RPC connectivity
npm run test:models    # Test data model parsing

# Launch breakout panes in separate terminal windows
npm run pane           # Lists available panes
npm run pane msg       # Messages pane
npm run pane agents    # Agents pane
npm run pane tasks     # Tasks pane
npm run pane alice-bob # Alice/Bob details

# Environment setup (required before running)
cp .env.template .env
# Edit .env with:
#   NEAR_NETWORK=mainnet|testnet|localnet
#   FASTNEAR_AUTH_TOKEN=your_token_here (for mainnet)
```

## Architecture Overview

### Core Components

1. **Main Dashboard** (`src/battle-station.tsx`) - The primary UI component that orchestrates multiple panes and acts as a WebSocket server on port 63736.

2. **Panes** (`src/panes/`) - Modular UI components for different data views:
   - `blocks/block-details.tsx` - Lists blockchain blocks
   - `transactions/tx-hashes.tsx` - Shows transaction hashes
   - `transactions/tx-details.tsx` - Displays decoded transaction details

3. **Breakout Panes** (`src/panes/breakout-panes/`) - Separate terminal windows that connect to the main dashboard via WebSockets for synchronized data display.

4. **Services**:
   - `near-rpc.ts` - NEAR Protocol RPC communication layer
   - `near-adapter.ts` - Converts RPC responses to dashboard data models
   - `Keybind` (singleton) - Central keyboard event handling via event emitter pattern
   - `connect.ts` - Establishes RPC connection and WebSocket server

5. **Data Models** (`src/model/`):
   - `NEARTypes.ts` - Complete NEAR type definitions, constants, and 17 utility functions
   - `BlockDetails.ts` - Simplified block model for dashboard display
   - `NEARTransactionDetails.ts` - Extended transaction model with execution results

### Key Architectural Patterns

1. **WebSocket Communication**: Main dashboard broadcasts selected block/transaction data to breakout panes. Protocol defined in `WSCSLIPayload` interface with types: "block", "tx", "msg", "address", "contract".

2. **HTTP Polling Architecture**: NEAR RPC doesn't support WebSocket subscriptions, so we poll for new blocks every 1 second via `BlockPoller` class. The poller fetches blocks, then fetches all transactions from chunks in parallel.

3. **Sharded Data Model**: NEAR uses sharding - transactions are not directly in blocks. Must fetch chunks to get transactions. The `near-adapter.ts` handles this automatically.

4. **State Management**: Component state with props drilling. No global state management library.

5. **Keyboard Navigation**: Tab cycles forward through panes (0→1→2), Shift+Tab cycles backward (0→2→1). Arrow keys navigate within panes. Events handled through `Keybind.sharedInstance()`.

### Data Flow

```
BlockPoller (1s interval) → getBlock() →
getBlockTransactions() → Fetch chunks in parallel →
Extract transactions → convertBlockToDetails() →
decorateActionRecursively() → decorateFunctionCallArgs() →
(decode base64 → parse JSON → auto-parse JSON strings → decode nested payloads) →
BlockDetails with fully decoded & parsed transactions →
Update UI → Broadcast to breakout panes via WebSocket
```

### NEAR-Specific Patterns

1. **Action-Based Transactions**: NEAR has 9 action types (Transfer, FunctionCall, CreateAccount, etc.) vs Cosmos's 50+ message types. Actions are simpler and already JSON - no protobuf decoding needed.

2. **Human-Readable Accounts**: `alice.near` instead of `cosmos1abc...`. No need for bech32 encoding/decoding.

3. **Chunk Fetching**: Always fetch chunks after getting a block. Chunks contain the actual transactions. The adapter handles this automatically.

4. **Authorization**: FastNEAR mainnet requires Bearer token authentication. Set `FASTNEAR_AUTH_TOKEN` in `.env`.

## Development Guidelines

### Working with Panes

- All panes receive `focused` prop to control keyboard event handling
- Use `Keybind.sharedInstance()` for keyboard events, not React events
- Clean up event listeners in `useEffect` cleanup functions

### Adding New Features

- New panes go in `src/panes/` following the existing pattern
- Breakout panes need entries in `src/new-pane.ts` and package.json scripts
- WebSocket message types must be added to `WSCSLIPayload` interface

### TypeScript Considerations

- **Keep it simple**: Bare minimum TypeScript, nothing clever or hard to read
- Follow the `/Users/mikepurvis/near/fastnear-js-monorepo` style: pragmatic, use `any` where it makes sense
- Strict interfaces for public APIs, flexible internals
- No over-engineering: type guards, complex generics, or fancy patterns not needed

### NEAR Integration

NEAR RPC is simpler than Cosmos:
- No protobuf encoding/decoding - everything is JSON
- No complex signing - transactions are already base64 encoded
- Straightforward RPC calls via `sendRpc(method, params)`
- Utility functions in `NEARTypes.ts` handle all common formatting needs

### Clipboard Architecture

Transaction data uses separate formatters for display vs export:
- `prepareTxForDisplay()` - Truncates long fields (public_key, signature) for terminal display using `shortMiddle()`
- `prepareTxForCopy()` - Full data without truncation for clipboard
- `txData` state - ANSI-colored JSON for display (via `ansiJson()`)
- `rawTxData` state - Plain JSON for clipboard (via `JSON.stringify()`)

#### Context-Aware Copy Behavior

Pressing 'c' copies different data based on which pane is focused:

**Blocks Pane (focusedPane === 0)**: Copies all transactions for the selected block
```json
{
  "network": "testnet",
  "block_height": 123456789,
  "block_hash": "ABC...",
  "timestamp": "2025-10-17T15:03:58Z",
  "tx_count": 5,
  "txs": [/* human-readable transactions */]
}
```

**Transactions Pane (focusedPane === 1)**: Copies both raw and decoded formats
```json
{
  "network": "testnet",
  "block_height": 123456789,
  "block_timestamp": "2025-10-17T15:03:58Z",
  "tx_hash": "8ZqXj...",
  "chain": {/* raw blockchain data with base64 args */},
  "human": {/* decoded with parsed args */}
}
```

**Transaction Details Pane (focusedPane === 2)**: Copies human-readable only (existing behavior)
```json
{
  "hash": "...",
  "signer": "alice.near",
  "receiver": "bob.near",
  "actions": [...]
}
```

Pane labels show copy hints only when focused. Display version shows truncated fields to save screen space, clipboard version contains complete data.

### Status Bar

Located at `src/ui/StatusBar.tsx`. Displays network, block height, follow mode status, FPS, and UTC time. Time uses ISO 8601 format (HH:MM:SS UTC) via `new Date().toISOString()`.

### JSON Auto-Parse

Located at `src/utils/json-auto-parse.ts` and integrated into `src/model/near-args-decoder.ts`. NEAR transactions often contain JSON-serialized strings as values (e.g., `"msg": "{\"foo\":\"bar\"}"`). These are automatically parsed during transaction decoding.

- JSON parsing is automatic and always enabled (no config option)
- Detects strings that look like JSON (starting with `{`/`[` and ending with `}`/`]`)
- Key-agnostic: works on any field name (`msg`, `payload`, `data`, etc.)
- Recursively processes up to 7 levels deep to handle deeply nested NEAR transaction structures
- Falls back gracefully if parsing fails - returns original string
- Applied during `decorateFunctionCallArgs` as part of the decoding process
- Also handles nested base64 payloads (e.g., in `execute_intents` transactions)

**Implementation**: Based on the clean Rust pattern from ratacat - decode, parse, and apply JSON parsing in a single pass.

### Binary/BORSH Arguments Display

Located in `src/model/near-args-decoder.ts`. Function call arguments that are binary or BORSH-serialized are handled specially:

- **Display**: Shows middle-truncated base64 (40 chars each side) with `[binary]` suffix
  - Example: `eJyVkN1u2z...4g1kFxkBxYz [binary]`
- **Clipboard**: Preserves full base64 string in `args_bytes` field for complete data export
- Detection: Uses regex `/^[\x20-\x7E\s]*$/` to identify non-printable characters

### Toast Notifications

Located at `src/ui/Toast.tsx`. Toasts provide user feedback with fade-in/fade-out animations:

- **Width**: 50% of screen (prevents text wrapping)
- **Duration**: 2300ms total (200ms fade-in, 1900ms steady, 200ms fade-out)
- **Animation**: Color-based fade using blessed's color palette
  - Fade in: `bright` colors (brightgreen, brightyellow, brightred)
  - Steady: Normal colors (green, yellow, red)
  - Fade out: `light` colors for dimming effect
- **Performance**: Re-renders every 100ms when toasts are visible (~23 renders per toast lifetime)

## Current Limitations

1. WebSocket port (63736) is hardcoded
2. Polling interval (1 second) is not configurable
3. No error boundaries for React components
4. No retry logic for failed RPC requests

## Important Files

### Core Infrastructure (Ready for Use)
- `src/services/near-rpc.ts` - NEAR RPC communication layer
- `src/services/near-adapter.ts` - Converts RPC responses to data models
- `src/model/NEARTypes.ts` - Type definitions and 17 utility functions
- `src/model/BlockDetails.ts` - Block model
- `src/model/NEARTransactionDetails.ts` - Transaction model
- `src/utils/connect.ts` - RPC and WebSocket connection setup

### UI Components (Pending Update)
- `src/battle-station.tsx` - Main application (needs NEAR adapter integration)
- `src/panes/blocks/block-details.tsx` - Block display (needs NEAR fields)
- `src/panes/transactions/tx-details.tsx` - Transaction display (needs NEAR actions)
- `src/services/Keybind.ts` - Keyboard event handling (unchanged)

### Tests (Working)
- `src/test-near-connection.ts` - RPC connectivity test (run with `npm run test:near`)
- `src/test-data-models.ts` - Data model validation (run with `npm run test:models`)

## Useful Constants and Utilities

```typescript
// From NEARTypes.ts
import {
  YOCTO_PER_NEAR,
  TERA_GAS,
  GIGA_GAS,
  formatNEAR,
  formatGas,
  nanosecToDate,
  getActionType,
  getActionDescription,
  decodeFunctionCallArgs,
} from './model/NEARTypes';

// From near-adapter.ts
import {
  fetchLatestBlock,
  convertBlockToDetails,
  getTransactionsForAccount,
  getTransactionsByActionType,
  calculateTPS,
} from './services/near-adapter';
```

## Next Steps for Migration

1. **Update `battle-station.tsx`**: Replace CosmJS client with NEAR adapter, use `BlockPoller`
2. **Update block panes**: Display NEAR block fields (chunks, timestamp, etc.)
3. **Update transaction panes**: Display NEAR actions instead of Cosmos messages
4. **Test end-to-end**: Run dashboard and verify real-time block updates work

See `MIGRATION-PLAN.md` and `SESSION-SUMMARY.md` for detailed migration documentation.