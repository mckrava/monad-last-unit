// Private keys arrive via env from Swarm secret files. Pastes and `cat` pick up
// stray whitespace, CRLF, quotes, or a missing 0x prefix, and viem then throws an
// opaque error deep in a route handler. Normalize here and fail LOUDLY with the
// variable name instead.

function normalize(value: string, label: string): `0x${string}` {
  const cleaned = value.trim().replace(/^['"]|['"]$/g, '');
  const hex = cleaned.startsWith('0x') || cleaned.startsWith('0X') ? cleaned.slice(2) : cleaned;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      `[keys] ${label} is malformed: expected 64 hex chars (0x prefix optional), got ${hex.length} chars` +
        `${/\r|\n/.test(value) ? ' (contains CR/LF — recreate the secret without a trailing newline)' : ''}`,
    );
  }
  return `0x${hex}` as `0x${string}`;
}

export function readPk(name: string): `0x${string}` {
  const raw = process.env[name];
  if (!raw) throw new Error(`[keys] ${name} is not set`);
  return normalize(raw, name);
}

export function readPkList(name: string, fallbackName: string): `0x${string}`[] {
  const raw = process.env[name];
  if (raw && raw.trim()) {
    return raw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .map((k, i) => normalize(k, `${name}[${i}]`));
  }
  return [readPk(fallbackName)];
}
