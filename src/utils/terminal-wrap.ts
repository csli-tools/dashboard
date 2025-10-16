// Inserts zero-width breakpoints into long, space-free tokens (base64/base58/hex, ed25519 keys, etc.)
// so blessed/neo-blessed can wrap them. Also preserves ANSI escape sequences.
// No deps.

const ZWSP = '\u200b';

// ANSI escape: \x1b[ ... letters
const ESC = '\x1b';
const CSI = '[';

function isAnsiStart(ch: string) { return ch === ESC; }
function isTokenChar(ch: string) {
  // base58/base64/hex-ish plus separators we often see (':' in ed25519:..., '_' in snake, '-' in ids)
  return /[0-9A-Za-z/+_=:\-]/.test(ch);
}

/**
 * Insert ZWSP every `maxRun` visible chars within long, space-free tokens.
 * Skips inside ANSI escape sequences.
 */
export function softWrapLongTokensAnsiAware(input: string, maxRun = 64): string {
  let out = '';
  let i = 0;
  let run = 0;
  let inAnsi = false;

  while (i < input.length) {
    const ch = input[i];

    if (inAnsi) {
      out += ch;
      // crude but effective: ANSI sequence ends on a letter (m, K, H, etc.)
      if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) inAnsi = false;
      i++;
      continue;
    }

    if (isAnsiStart(ch)) {
      inAnsi = true;
      out += ch;
      i++;
      continue;
    }

    if (isTokenChar(ch)) {
      run++;
      out += ch;
      if (run >= maxRun) {
        out += ZWSP; // invisible break chance
        run = 0;
      }
    } else {
      // reset run on whitespace, punctuation, etc.
      out += ch;
      run = 0;
    }
    i++;
  }

  return out;
}

export function ensureTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : s + '\n';
}