/**
 * Auto-parse JSON-serialized strings in nested transaction data
 *
 * NEAR transactions often contain JSON strings as values, e.g.:
 *   "msg": "{\"foo\":\"bar\"}"
 *
 * This utility detects and parses these strings for better readability.
 * Key-agnostic: works on any field containing a JSON string.
 *
 * Used during transaction decoding to automatically parse JSON strings
 * as soon as they're decoded from base64.
 *
 * Based on the cleaner Rust implementation from ratacat.
 */

// Security: Maximum string length to parse (1MB)
const MAX_STRING_LENGTH = 1024 * 1024;

/**
 * Recursively walks an object/array and parses JSON-serialized strings
 * @param obj - The object to process
 * @param maxDepth - Maximum recursion depth (prevents infinite loops) - defaults to 7
 * @param currentDepth - Current recursion depth (internal)
 * @returns Processed object with parsed JSON strings
 */
export function autoParseNestedJson(obj: any, maxDepth = 7, currentDepth = 0): any {
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
    // Security: Skip parsing very large strings to prevent JSON bomb attacks
    if (obj.length > MAX_STRING_LENGTH) {
      return obj;
    }

    // Quick check: does it look like JSON?
    const trimmed = obj.trim();

    // Catch all JSON structures: objects {}, arrays [], including [{...}], [123], etc.
    if ((trimmed.startsWith('{') || trimmed.startsWith('[')) &&
        (trimmed.endsWith('}') || trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        // Recursively process the result in case it contains nested JSON strings
        return autoParseNestedJson(parsed, maxDepth, currentDepth + 1);
      } catch (e) {
        // Log for debugging if needed
        if (process.env.DEBUG_JSON_PARSE === '1') {
          console.error('Failed to parse apparent JSON:', trimmed.substring(0, 100) + '...', e);
        }
      }
    }
    // Not valid JSON or doesn't look like JSON, return original string
    return obj;
  }

  // Primitive values (numbers, booleans, etc.)
  return obj;
}
