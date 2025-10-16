import * as dotenv from 'dotenv';
dotenv.config();

export type JSONFormatterKind = 'worker' | 'wasm';
export type Network = 'mainnet' | 'testnet' | 'localnet';
export type BlessedRuntime = 'neo' | 'classic';

function int(name: string, def: number, min?: number, max?: number): number {
  const raw = process.env[name];
  let v = raw === undefined ? def : Number(raw);
  if (!Number.isFinite(v)) v = def;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  return Math.trunc(v);
}

function str<T extends string>(name: string, def?: T): T | undefined {
  const v = process.env[name];
  return (v === undefined ? def : (v as T));
}

function choice<T extends string>(name: string, values: readonly T[], def: T): T {
  const v = (process.env[name] ?? def) as T;
  return (values as readonly string[]).includes(v) ? v : def;
}

function intList(name: string, def: number[], min = 1, max = 120): number[] {
  const v = process.env[name];
  if (!v) return def;
  const out = v.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n >= min && n <= max);
  return out.length ? out : def;
}

function bool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return def;
  return v === 'true' || v === '1';
}

export interface Config {
  NEAR_NETWORK: Network;
  FASTNEAR_AUTH_TOKEN?: string;

  WS_PORT: number;

  RPC_TIMEOUT_MS: number;
  RPC_RETRIES: number;

  POLL_INTERVAL_MS: number;
  POLL_MAX_CATCHUP: number;
  POLL_CHUNK_CONCURRENCY: number;

  WS_HIGH_WATER_MARK: number;

  JSON_FORMATTER: JSONFormatterKind;
  JSON_FORMAT_TIMEOUT_MS: number;

  CB_FAILURE_THRESHOLD: number;
  CB_RESET_AFTER_MS: number;

  BLESSED_RUNTIME: BlessedRuntime;

  RENDER_FPS: number;
  RENDER_FPS_CHOICES: number[];

  SHOW_ARGS_BASE64: boolean;
}

const CFG: Config = Object.freeze({
  NEAR_NETWORK: choice('NEAR_NETWORK', ['mainnet', 'testnet', 'localnet'] as const, 'testnet'),
  FASTNEAR_AUTH_TOKEN: str('FASTNEAR_AUTH_TOKEN'),

  WS_PORT: int('WS_PORT', 63736, 1, 65535),

  RPC_TIMEOUT_MS: int('RPC_TIMEOUT_MS', 8000, 100, 60000),
  RPC_RETRIES: int('RPC_RETRIES', 2, 0, 8),

  POLL_INTERVAL_MS: int('POLL_INTERVAL_MS', 1000, 50, 20000),
  POLL_MAX_CATCHUP: int('POLL_MAX_CATCHUP', 5, 1, 100),
  POLL_CHUNK_CONCURRENCY: int('POLL_CHUNK_CONCURRENCY', 4, 1, 64),

  WS_HIGH_WATER_MARK: int('WS_HIGH_WATER_MARK', 1_000_000, 0, 50_000_000),

  JSON_FORMATTER: choice('JSON_FORMATTER', ['worker', 'wasm'] as const, 'worker'),
  JSON_FORMAT_TIMEOUT_MS: int('JSON_FORMAT_TIMEOUT_MS', 5000, 100, 60000),

  CB_FAILURE_THRESHOLD: int('CB_FAILURE_THRESHOLD', 8, 1, 100),
  CB_RESET_AFTER_MS: int('CB_RESET_AFTER_MS', 10_000, 1000, 300_000),

  BLESSED_RUNTIME: choice('BLESSED_RUNTIME', ['neo', 'classic'] as const, 'neo'),

  RENDER_FPS: int('RENDER_FPS', 30, 1, 120),
  RENDER_FPS_CHOICES: intList('RENDER_FPS_CHOICES', [20, 30, 60], 1, 120),

  SHOW_ARGS_BASE64: bool('SHOW_ARGS_BASE64', false),
});

export function cfg(): Config { return CFG; }