import type * as blessedTypes from 'blessed';

export type RenderSchedulerOpts = {
  fps?: number;
  onLateFrameMs?: number;
};

export interface RenderScheduler {
  uninstall(): void;
  setFps(nextFps: number): void;
  getFps(): number;
  renderNow(): void;
}

export function installRenderScheduler(
  screen: blessedTypes.Widgets.Screen,
  opts: RenderSchedulerOpts = {}
): RenderScheduler {
  let fps = clamp(opts.fps ?? 30, 1, 120);
  let frameMs = Math.floor(1000 / fps);
  const onLate = opts.onLateFrameMs;

  let scheduled = false;
  let lastRender = 0;

  const _renderOriginal = screen.render.bind(screen);

  function run() {
    scheduled = false;
    const start = Date.now();
    _renderOriginal();
    lastRender = start;
    const dur = Date.now() - start;
    if (onLate && dur > onLate) {
      try { console.warn(`[scheduled-screen] slow frame: ${dur}ms @ ${fps}fps`); } catch {}
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    const now = Date.now();
    const dt = now - lastRender;
    const delay = dt >= frameMs ? 0 : (frameMs - dt);
    setTimeout(run, delay);
  }

  (screen as any).__render_original__ = _renderOriginal;
  (screen as any).renderNow = _renderOriginal;
  (screen as any).render = schedule;

  const onResize = () => schedule();
  screen.on('resize', onResize);

  function setFps(next: number) {
    fps = clamp(next, 1, 120);
    frameMs = Math.floor(1000 / fps);
  }

  function getFps() { return fps; }

  function uninstall() {
    try { screen.off('resize', onResize); } catch {}
    (screen as any).render = _renderOriginal;
    delete (screen as any).renderNow;
    delete (screen as any).__render_original__;
  }

  return { uninstall, setFps, getFps, renderNow: _renderOriginal };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}