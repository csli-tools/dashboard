/**
 * Auto-parse JSON-serialized strings in nested transaction data
 *
 * NEAR transactions often contain JSON strings as values, e.g.:
 *   "msg": "{\"foo\":\"bar\"}"
 *
 * This utility detects and parses these strings for better readability.
 */

/**
 * Recursively walks an object/array and parses JSON-serialized strings
 * @param obj - The object to process
 * @param maxDepth - Maximum recursion depth (prevents infinite loops)
 * @param currentDepth - Current recursion depth (internal)
 * @returns Processed object with parsed JSON strings
 */
export function autoParseNestedJson(obj: any, maxDepth = 5, currentDepth = 0): any {
  // Safety guard: prevent infinite recursion
  if (currentDepth >= maxDepth) return obj;

  // Handle null/undefined
  if (obj == null) return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => autoParseNestedJson(item, maxDepth, currentDepth + 1));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = autoParseNestedJson(value, maxDepth, currentDepth + 1);
    }
    return result;
  }

  // Handle strings: detect and parse JSON
  if (typeof obj === 'string') {
    // Quick check: does it look like JSON?
    const trimmed = obj.trim();
    if ((trimmed.startsWith('{"') || trimmed.startsWith('["')) &&
        (trimmed.endsWith('}') || trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        // Recursively parse the result in case it contains nested JSON strings
        return autoParseNestedJson(parsed, maxDepth, currentDepth + 1);
      } catch {
        // Not valid JSON, return original string
        return obj;
      }
    }
  }

  // Primitive values (numbers, booleans, etc.)
  return obj;
}
