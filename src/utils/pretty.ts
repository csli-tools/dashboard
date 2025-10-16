// Lightweight ANSI JSON formatter to replace spawning `jq`.
// No deps; works in any Node terminal (incl. blessed).

export function ansiJson(value: any, space = 2): string {
  const C = {
    reset: '\x1b[0m',
    key: '\x1b[36m',       // cyan
    string: '\x1b[32m',    // green
    number: '\x1b[33m',    // yellow
    boolean: '\x1b[35m',   // magenta
    null: '\x1b[90m',      // grey
    punctuation: '\x1b[37m'// white
  };

  const seen = new WeakSet();

  function fmt(v: any, indent: number): string {
    const pad = ' '.repeat(indent);
    if (v === null) return C.null + 'null' + C.reset;
    const t = typeof v;
    if (t === 'string') {
      // For long strings (addresses, hashes), truncate intelligently
      if (v.length > 60 && (v.match(/^[a-f0-9]{64,}$/i) || v.includes('.near'))) {
        // If it's a hash or long address, show first and last parts
        if (v.length > 60) {
          const display = v.substring(0, 20) + '...' + v.substring(v.length - 20);
          return C.string + JSON.stringify(display) + C.reset;
        }
      }
      return C.string + JSON.stringify(v) + C.reset;
    }
    if (t === 'number') return C.number + String(v) + C.reset;
    if (t === 'boolean') return C.boolean + String(v) + C.reset;
    if (t !== 'object') return String(v);

    if (seen.has(v)) return C.null + '"[Circular]"' + C.reset;
    seen.add(v);

    if (Array.isArray(v)) {
      if (v.length === 0) return '[]';
      const items = v.map(i => fmt(i, indent + space));
      return '[\n' + items.map(s => pad + ' '.repeat(space) + s).join(',\n') + '\n' + pad + ']';
    }

    const keys = Object.keys(v);
    if (keys.length === 0) return '{}';
    const items = keys.map(k => {
      const coloredKey = C.key + JSON.stringify(k) + C.reset;
      return pad + ' '.repeat(space) + coloredKey + C.punctuation + ': ' + C.reset + fmt((v as any)[k], indent + space);
    });
    return '{\n' + items.join(',\n') + '\n' + pad + '}';
  }

  return fmt(value, 0);
}
