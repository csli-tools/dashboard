# Feature: Marks, Filter, and History

## Status: Implementation in Progress

This feature branch adds comprehensive transaction exploration capabilities to the NEAR dashboard.

## Completed Components

### Service Layer ✅
- **`services/history.ts`** - SQLite persistence for blocks, transactions, and marks
- **`services/jump-marks.ts`** - Mark management with pinning and navigation
- **`services/filters.ts`** - Transaction filter compilation and matching

### Data Processing ✅
- **`model/near-args-decoder.ts`** - Decodes FunctionCall arguments (JSON/text/binary)
- **`utils/json-formatter-worker.ts`** - JSON formatting with ANSI colors
- **`utils/json-formatter-wasm.ts`** - WASM-based JSON formatting (placeholder)

### UI Components ✅
- **`panes/filter/FilterBar.tsx`** - Live transaction filtering input
- **`panes/history/HistorySearch.tsx`** - Search historical transactions (Ctrl+F)
- **`panes/jumps/JumpList.tsx`** - Mark management overlay (M key)

### Updated Components ✅
- **`ui/StatusBar.tsx`** - Added viewMode, pinnedLabels, pinnedTotal props
- **`ui/HelpOverlay.tsx`** - Complete keyboard shortcuts documentation
- **`panes/transactions/tx-details.tsx`** - Added mode prop for Pretty/Raw toggle

### Configuration ✅
- **`.env.template`** - Added SQLITE_DB_PATH configuration
- **`package.json`** - Added better-sqlite3, clipboardy dependencies

## Remaining Work

### Integration 🚧
- **`src/battle-station.tsx`** - Needs comprehensive update to integrate all features

The battle-station integration requires:
1. Import new components (FilterBar, HistorySearch, JumpList)
2. Import new services (history, jump-marks, filters)
3. Add state management for:
   - viewMode ('pretty' | 'raw')
   - filterQuery and compiled filters
   - marks array and JumpMarks ref
   - overlay toggles (filterFocused, historyOpen, jumpsOpen)
4. Initialize history database on mount
5. Load marks from persistence
6. Implement keyboard handlers:
   - `v` - Toggle pretty/raw mode
   - `/` or `f` - Focus filter bar
   - `Ctrl+F` - Open history search
   - `m` - Set auto mark
   - `M` - Open marks overlay
   - `Ctrl+P` - Toggle pin current context
   - `'` - Jump to mark by label
   - `[` / `]` - Prev/Next mark
7. Update displayTransaction for pretty/raw modes
8. Add buildPretty() helper for simplified view
9. Implement jump navigation (jumpTo, jumpNext, jumpPrev)
10. Add context tracking for marks (ctx() function)
11. Update StatusBar props with viewMode, pinnedLabels, pinnedTotal
12. Add clipboardy for cross-platform clipboard support

## Features

### 1. Transaction Filtering
**Syntax:** `key:value` pairs separated by spaces

```
signer:alice.near          # Filter by signer account
receiver:game.hot.tg       # Filter by receiver account
method:transfer            # Filter by function call method
action:FunctionCall        # Filter by action type
```

**Usage:**
- Press `/` or `f` to focus filter bar
- Type filter query
- Press Enter to apply
- Press Esc to cancel

### 2. History Search
**Feature:** Search all historical transactions stored in SQLite

**Usage:**
- Press `Ctrl+F` to open history search
- Type 2+ characters to search
- Search includes: hash, signer, receiver
- Navigate with arrow keys
- Press Enter to open transaction
- Press Esc to close

### 3. Marks & Jump Navigation
**Feature:** Bookmark blocks/transactions for quick navigation

**Auto Marks:**
- Press `m` to set auto-numbered mark (1, 2, 3...)
- Captures current context (block height, transaction hash, pane)

**Named Marks:**
- Use Command Palette (Ctrl+K) to set named marks

**Jump Navigation:**
- Press `'` then label to jump to mark
- Press `[` for previous mark
- Press `]` for next mark

**Pinning:**
- Press `Ctrl+P` to pin/unpin current context
- Pinned marks appear in status bar: `★[1 2 3] (+2)`
- Up to 3 labels shown, overflow indicated

**Marks Overlay:**
- Press `M` to open marks management
- `p` - Toggle pin
- `d` - Delete mark
- Enter - Jump to mark
- Esc - Close

### 4. View Modes
**Pretty Mode:** Simplified, human-readable view
- Shows only essential fields
- Decodes FunctionCall arguments
- Displays hint: "(v for RAW)"

**Raw Mode:** Complete transaction data
- Full JSON structure
- All fields included
- No truncation

**Toggle:** Press `v` to switch between modes

### 5. Persistent Storage
**SQLite Database:** `./csli_history.db` (configurable)

**Tables:**
- `blocks` - Block metadata
- `transactions` - Full transaction data
- `marks` - Saved bookmarks

**Indexes:**
- Transaction signer, receiver, block_height
- Optimized for fast searching

## Architecture

### Data Flow
```
BlockPoller → onNewBlock() → persistBlock() → SQLite
                           → setBlockHeights() → React State

User Filter → compileFilter() → txMatchesFilter() → Filtered List

User Search → searchHistory() → SQLite Query → Results

User Mark → JumpMarks.add() → persistence.put() → SQLite
```

### Clipboard Integration
- Uses `clipboardy` for cross-platform support
- Copies `rawTxData` (no ANSI codes)
- Full transaction data (no truncation)
- Works on macOS, Linux, Windows

## Configuration

### Environment Variables
```bash
# SQLite database path
SQLITE_DB_PATH=./csli_history.db

# JSON formatter (worker or wasm)
JSON_FORMATTER=worker

# WebSocket high water mark
WS_HIGH_WATER_MARK=1000000
```

## Testing

Run tests after integration:
```bash
# Start dashboard
npm run start

# Test features:
# 1. Filter: / then "signer:alice.near"
# 2. History: Ctrl+F, search for hash
# 3. Marks: m to set, M to view, Ctrl+P to pin
# 4. View toggle: v to switch pretty/raw
# 5. Navigation: [ and ] to cycle marks
```

## Documentation Updates Needed
- Update CLAUDE.md with new features
- Update README.md with keyboard shortcuts
- Add filtering syntax examples
- Document marks persistence

## Commits
1. `7564a75` - Add dependencies for marks, filter, and history features
2. `2844e1d` - Add service layer: history, jump-marks, filters
3. `3f21d67` - Add UI components and utilities
4. `a456ece` - Update UI components for new features
5. `613eef6` - Update configuration for history persistence

## Next Steps
1. Complete battle-station.tsx integration (see specification above)
2. Test all features end-to-end
3. Update documentation
4. Create pull request against `near` branch
