/**
 * Common types used throughout the application
 *
 * Following the "simple TypeScript" principle:
 * - Only define types that help catch bugs
 * - Keep it readable and practical
 * - Use 'any' when it makes sense
 */

// Blessed screen type - we don't need full typing, just the methods we use
export interface BlessedScreen {
  render(): void;
  destroy(): void;
  key(keys: string | string[], callback: (ch: any, key: any) => void): void;
  title?: string;
}

// Simple action type for NEAR transactions
export interface NEARAction {
  FunctionCall?: {
    method_name: string;
    args?: any;  // Can be string, object, or base64
    gas?: string;
    deposit?: string;
  };
  Transfer?: {
    deposit: string;
  };
  Delegate?: {
    delegate_action: {
      sender_id: string;
      receiver_id: string;
      actions: NEARAction[];
    };
  };
  // Add other action types as needed
}

// Database row types - just what we actually use
export interface BlockRow {
  height: number;
  hash: string;
  ts_ms: number;
  tx_count?: number;
}

export interface TransactionRow {
  hash: string;
  height: number;
  signer?: string | null;
  receiver?: string | null;
  actions_json?: string | null;
  raw_json?: string | null;
  methods?: string;
  ts_ms?: number;
}

// Mark (bookmark) type
export interface Mark {
  label: string;
  pane: number;
  height?: number | null;
  tx?: string | null;
  when_ms: number;
  pinned?: boolean;
}

// Common callback types
export type ErrorCallback = (error: Error | null) => void;
export type DataCallback<T> = (error: Error | null, data?: T) => void;

// Clipboard module type (external)
export interface Clipboardy {
  write(text: string): Promise<void>;
  writeSync(text: string): void;
  read(): Promise<string>;
  readSync(): string;
}

// JSON formatter function type
export type JSONFormatter = (value: any, spaces?: number) => Promise<string>;