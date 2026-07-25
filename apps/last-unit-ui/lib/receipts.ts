// In-memory receipt store: 6-digit code -> latest signed redemption bundle.
// The code is stable per token (the cashier types it); the bundle behind it
// rotates every second from the holder's phone, mirroring the storefront's
// freshness property at the exit.

export type RedeemBundle = {
  nonce: string; // bigint as string
  challengeBlock: number;
  ownerSig: `0x${string}`;
  updatedAt: number;
};

export type Receipt = {
  code: string;
  tokenId: string;
  player: string;
  bundle?: RedeemBundle;
};

function createReceipts() {
  const byCode = new Map<string, Receipt>();
  const byToken = new Map<string, string>();

  function open(tokenId: string, player: string): Receipt {
    const existing = byToken.get(tokenId);
    if (existing) {
      const r = byCode.get(existing)!;
      r.player = player; // same device reopening; ownership re-checked by the route
      return r;
    }
    let code: string;
    do {
      code = String(Math.floor(100000 + Math.random() * 900000));
    } while (byCode.has(code));
    const receipt: Receipt = { code, tokenId, player };
    byCode.set(code, receipt);
    byToken.set(tokenId, code);
    return receipt;
  }

  function refresh(code: string, bundle: RedeemBundle): boolean {
    const r = byCode.get(code);
    if (!r) return false;
    r.bundle = bundle;
    return true;
  }

  function get(code: string): Receipt | undefined {
    return byCode.get(code);
  }

  return { open, refresh, get };
}

const g = globalThis as any;
export const receipts: ReturnType<typeof createReceipts> =
  g.__db_receipts ?? (g.__db_receipts = createReceipts());
