import { NextRequest, NextResponse } from 'next/server';
import { beacon } from '@/lib/beacon';
import { ACTIVE_DROP, CHECKPOINT } from '@/lib/chain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cpId = BigInt(sp.get('cpId') ?? String(CHECKPOINT));
  const dropId = BigInt(sp.get('dropId') ?? String(ACTIVE_DROP));
  const ch = await beacon.issue(cpId, dropId);
  return NextResponse.json({
    id: ch.id,
    cpId: String(ch.cpId),
    dropId: String(ch.dropId),
    nonce: String(ch.nonce),
    challengeBlock: Number(ch.challengeBlock),
    url: ch.url,
  });
}
