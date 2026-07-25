// Private keys arrive via env from Swarm secret files. Pastes and `cat` pick up
// stray whitespace, CRLF, or quotes, and viem then throws an opaque error deep in
// a route handler. Normalize here and fail LOUDLY with the variable name instead.
export function readPk(name: string): `0x${string}` {
  const raw = process.env[name];
  if (!raw) throw new Error(`[keys] ${name} is not set`);
  const cleaned = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!/^0x[0-9a-fA-F]{64}$/.test(cleaned)) {
    throw new Error(
      `[keys] ${name} is malformed: expected 0x + 64 hex chars, got ${cleaned.length} chars` +
        `${/\r|\n/.test(raw) ? ' (contains CR/LF — recreate the secret without a trailing newline)' : ''}`,
    );
  }
  return cleaned as `0x${string}`;
}

export function readPkList(name: string, fallbackName: string): `0x${string}`[] {
  const raw = process.env[name];
  if (raw && raw.trim()) {
    return raw
      .split(',')
      .map((k) => k.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
      .map((k, i) => {
        if (!/^0x[0-9a-fA-F]{64}$/.test(k)) throw new Error(`[keys] ${name}[${i}] is malformed`);
        return k as `0x${string}`;
      });
  }
  return [readPk(fallbackName)];
}
