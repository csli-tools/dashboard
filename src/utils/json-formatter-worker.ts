import { ansiJson } from './pretty';

export async function formatJson(value: any, space: number = 2): Promise<string> {
  // Use the existing ansiJson formatter
  return ansiJson(value, space);
}
