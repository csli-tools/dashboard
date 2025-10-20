import React from 'react';
import { Server, WebSocket } from 'ws';
import { cfg } from './shared/config';
import { installRenderScheduler } from './ui/scheduled-screen';
import ErrorBoundary from './panes/ErrorBoundary';
import { Dashboard } from './battle-station';
import { WebSocketManager } from './services/websocket-manager';
import { installGlobalErrorHandlers } from './utils/error-handler';

// Install global error handlers for uncaught exceptions
installGlobalErrorHandlers();

// Choose runtime: neo-blessed (default) or classic blessed
const blessedRuntime = cfg().BLESSED_RUNTIME;
const blessed = blessedRuntime === 'classic' ? require('blessed') : require('neo-blessed');
const { createBlessedRenderer } = require('react-blessed');
const render = createBlessedRenderer(blessed);

// Screen
const screen = blessed.screen({
  smartCSR: true,
  autoPadding: true,
  sendFocus: true,
  warnings: false,
  title: `CSLI Dashboard • ${cfg().RENDER_FPS} FPS`
});

// Coalesced rendering with live FPS tuning
const scheduler = installRenderScheduler(screen, { fps: cfg().RENDER_FPS, onLateFrameMs: 20 });

// WebSocket server with thread-safe connection management
const wss = new Server({ port: cfg().WS_PORT });
const wsManager = new WebSocketManager(wss, {
  maxConnections: cfg().WS_MAX_CONNECTIONS ?? 100,
  maxBufferSize: cfg().WS_HIGH_WATER_MARK ?? 1024 * 1024
});

// Ctrl+O — cycle through FPS choices from .env
const choices = cfg().RENDER_FPS_CHOICES;
let idx = Math.max(0, choices.indexOf(cfg().RENDER_FPS));
screen.key(['C-o'], () => {
  idx = (idx + 1) % choices.length;
  const next = choices[idx];
  scheduler.setFps(next);
  try { screen.title = `CSLI Dashboard • ${next} FPS`; } catch {}
  scheduler.renderNow();
});

// Quit
function shutdown() {
  try { wsManager.closeAll(); } catch {}
  try { scheduler.uninstall(); } catch {}
  try { screen.destroy(); } catch {}
  process.exit(0);
}
screen.key(['C-c', 'q'], shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Render app
render(
  <ErrorBoundary>
    <Dashboard screen={screen} wss={wss} wsManager={wsManager} />
  </ErrorBoundary>,
  screen
);