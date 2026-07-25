/** 740 -> "740ms", 2400 -> "2.4s". Never collapse chainMs and endToEndMs into one figure. */
export function ms(v: number): string {
  return v < 1000 ? `${v}ms` : `${(v / 1000).toFixed(1)}s`;
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function block(n: number): string {
  return n.toLocaleString('en-US');
}

/** Share of end-to-end time that was actually on chain, as a percentage. */
export function chainShare(chainMs: number, endToEndMs: number): number {
  return Math.max(4, Math.min(100, (chainMs / endToEndMs) * 100));
}
