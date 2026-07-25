import { NextRequest, NextResponse } from 'next/server';
import { beacon } from '@/lib/beacon';
import { watcher } from '@/lib/watcher';
import { ACTIVE_DROP, CHECKPOINT } from '@/lib/chain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cpId = BigInt(sp.get('cpId') ?? String(CHECKPOINT));
  const dropId = BigInt(sp.get('dropId') ?? String(ACTIVE_DROP));
  watcher.trackDrop(dropId); // make sure this drop's status flows to the SSE clients
  const ch = await beacon.issue(cpId, dropId);
  return NextResponse.json({
    id: ch.id,
    cpId: Number(ch.cpId),
    dropId: Number(ch.dropId),
    nonce: String(ch.nonce), // 128-bit: stays a string, Number would corrupt it
    challengeBlock: Number(ch.challengeBlock),
    url: ch.url,
  });
}
