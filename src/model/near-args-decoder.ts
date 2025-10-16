import { Buffer } from 'buffer';

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
      return {
        FunctionCall: {
          ...fc,
          args: parsed,
          args_json: parsed
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

      // Binary data
      return {
        FunctionCall: {
          ...fc,
          args: `<${decoded.length} bytes>`,
          args_bytes: argsBase64
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
