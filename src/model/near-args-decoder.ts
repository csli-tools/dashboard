import { Buffer } from 'buffer';
import { autoParseNestedJson } from '../utils/json-auto-parse';

export function decorateFunctionCallArgs(action: any): any {
  if (!action.FunctionCall) return action;

  const fc = action.FunctionCall;
  const argsBase64 = fc.args;

  if (!argsBase64 || typeof argsBase64 !== 'string') {
    return action;
  }

  try {
    // Decode base64
    const decoded = Buffer.from(argsBase64, 'base64').toString('utf8');

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(decoded);

      // Apply JSON string parsing immediately (like Rust does)
      let processed = autoParseNestedJson(parsed);

      // Check for nested base64 payloads and decode them
      processed = decodeNestedPayloads(processed);

      return {
        FunctionCall: {
          ...fc,
          args: processed,
          args_json: processed
        }
      };
    } catch {
      // Not JSON, check if it's readable text
      if (/^[\x20-\x7E\s]*$/.test(decoded)) {
        return {
          FunctionCall: {
            ...fc,
            args: decoded,
            args_text: decoded
          }
        };
      }

      // Binary data - show middle-truncated base64
      const keepEachSide = 20;
      let displayArgs: string;
      if (argsBase64.length <= keepEachSide * 2 + 3) {
        displayArgs = `${argsBase64} (${decoded.length} bytes)`;
      } else {
        displayArgs = `${argsBase64.slice(0, keepEachSide)}...${argsBase64.slice(-keepEachSide)} (${decoded.length} bytes)`;
      }

      return {
        FunctionCall: {
          ...fc,
          args: displayArgs,
          args_bytes: argsBase64  // Full base64 for clipboard
        }
      };
    }
  } catch (err) {
    return {
      FunctionCall: {
        ...fc,
        args: '<decode error>',
        args_error: String(err)
      }
    };
  }
}

/**
 * Decode nested base64 payloads (like in execute_intents)
 * After decoding, immediately applies JSON string parsing to catch
 * fields like `message` that contain stringified JSON.
 */
function decodeNestedPayloads(obj: any): any {
  if (obj == null) return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => decodeNestedPayloads(item));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check for payload fields that might be base64
      if ((key === 'payload' || key.endsWith('_payload')) && typeof value === 'string') {
        try {
          const decoded = Buffer.from(value, 'base64').toString('utf8');
          try {
            // Parse and immediately apply JSON string parsing
            const parsed = JSON.parse(decoded);
            result[key] = autoParseNestedJson(parsed);
          } catch {
            // Not JSON, check if readable
            if (/^[\x20-\x7E\s]*$/.test(decoded)) {
              result[key] = decoded;
            } else {
              result[key] = value; // Keep original base64
            }
          }
        } catch {
          result[key] = value; // Not valid base64
        }
      } else {
        // Recursively process other fields
        result[key] = decodeNestedPayloads(value);
      }
    }
    return result;
  }

  return obj;
}
