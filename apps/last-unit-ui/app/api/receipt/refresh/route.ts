import { NextRequest, NextResponse } from 'next/server';
import { receipts } from '@/lib/receipts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { code, nonce, challengeBlock, ownerSig } = (await req.json()) as {
    code: string;
    nonce: string;
    challengeBlock: number;
    ownerSig: `0x${string}`;
  };
  if (!code || !nonce || challengeBlock == null || !ownerSig) {
    return NextResponse.json({ error: 'BadRequest' }, { status: 400 });
  }
  const ok = receipts.refresh(code, { nonce, challengeBlock, ownerSig, updatedAt: Date.now() });
  if (!ok) return NextResponse.json({ error: 'UnknownCode' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
