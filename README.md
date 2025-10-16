# CSLI Dashboard

Terminal-based block explorer and development tool for NEAR Protocol. Provides real-time monitoring of blockchain activity through a React-based terminal UI using the blessed library.

## Setup

### Environment Configuration

Copy the template and configure your environment:

```bash
cp .env.template .env
```

Edit `.env`:

```
NEAR_NETWORK=mainnet|testnet|localnet
FASTNEAR_AUTH_TOKEN=your_token_here  # Required for mainnet
```

For mainnet access, obtain a FastNEAR authentication token and set `FASTNEAR_AUTH_TOKEN`.

### Installation

```bash
npm install
```

## Usage

### Main Dashboard

Start the primary dashboard:

```bash
npm run start
```

The dashboard polls for new blocks every 1 second and displays:
- Block list with heights, hashes, and timestamps
- Transaction hashes for selected block
- Decoded transaction details with actions

### Keyboard Navigation

- `Tab` - Cycle between panes
- `↑/↓` - Navigate within pane
- `←/→` - Page up/down (6 lines)
- `PageUp/PageDown` - Page navigation
- `Home/End` - Jump to top/bottom
- `c` - Copy transaction details to clipboard
- `Ctrl+L` - Toggle follow latest block
- `?` or `h` - Show help overlay
- `Ctrl+K` - Open command palette
- `Esc` - Close overlays

### Breakout Panes

Launch additional terminal windows for specific data views:

```bash
npm run pane        # List available panes
npm run pane msg    # Messages pane
```

Breakout panes connect to the main dashboard via WebSocket (port 63736) for synchronized data display.

### Testing

```bash
npm run test:near    # Test RPC connectivity
npm run test:models  # Validate data model parsing
```

## Architecture

See `CLAUDE.md` for detailed technical documentation including:
- Core component architecture
- Data flow and polling mechanism
- NEAR-specific patterns (sharding, actions, accounts)
- Clipboard architecture (display vs copy formatters)
- WebSocket communication protocol
- State management patterns

## Features

- Real-time block monitoring with 1-second polling
- Transaction decoding with action parsing
- Human-readable account names (alice.near)
- Clipboard copy with full data (press 'c')
- UTC time display in status bar
- WebSocket broadcasting to breakout panes
- Follow mode for automatic latest block selection
