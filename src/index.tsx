import React from 'react';
import { Server, WebSocket } from 'ws';
import { cfg } from './shared/config';
import { installRenderScheduler } from './ui/scheduled-screen';
import ErrorBoundary from './panes/ErrorBoundary';
import { Dashboard } from './battle-station';

// Choose runtime: neo-blessed (default) or classic blessed
const blessedRuntime = cfg().BLESSED_RUNTIME;
const blessed = blessedRuntime === 'classic' ? require('blessed') : require('neo-blessed');
const { createBlessedRenderer } = require('react-blessed');
const render = createBlessedRenderer(blessed);

// Screen
const screen = blessed.screen({
  smartCSR: true,
  autoPadding: true,
  title: `CSLI Dashboard • ${cfg().RENDER_FPS} FPS`
});

// Coalesced rendering with live FPS tuning
const scheduler = installRenderScheduler(screen, { fps: cfg().RENDER_FPS, onLateFrameMs: 20 });

// WebSocket server with keep-alive (avoids send-buffer stalls)
const wss = new Server({ port: cfg().WS_PORT });
type ExtWS = WebSocket & { isAlive?: boolean };
wss.on('connection', (ws: ExtWS) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});
const ka = setInterval(() => {
  for (const ws of wss.clients) {
    const s = ws as ExtWS;
    if (s.isAlive === false) { try { s.terminate(); } catch {} continue; }
    s.isAlive = false;
    try { s.ping(); } catch {}
  }
}, 15_000);
wss.on('close', () => clearInterval(ka));

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
    <Dashboard screen={screen} wss={wss} />
  </ErrorBoundary>,
  screen
);