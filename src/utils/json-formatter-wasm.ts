import { ansiJson } from './pretty';

// WASM variant - for now, same as worker until we have actual WASM formatter
export async function formatJsonWasm(value: any, space: number = 2): Promise<string> {
  return ansiJson(value, space);
}
