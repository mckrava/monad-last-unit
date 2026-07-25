import { NextRequest, NextResponse } from 'next/server';
import { beacon } from '@/lib/beacon';
import { relayer } from '@/lib/relayer';
import { errorCopy } from '@/lib/errors';
import { EXPLORER } from '@/lib/chain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, playerSig, clientElapsedMs } = body as {
    id: string;
    playerSig: `0x${string}`;
    clientElapsedMs?: number;
  };

  const challenge = beacon.get(id);
  if (!challenge) {
    return NextResponse.json(
      { status: 'error', errorName: 'UnknownChallenge', copy: 'This code has expired. Scan again.' },
      { status: 404 },
    );
  }

  const result = await relayer.submit(challenge, playerSig, clientElapsedMs ?? 0);

  if (result.status === 'success') {
    return NextResponse.json({
      ...result,
      explorerUrl: `${EXPLORER}/tx/${result.txHash}`,
    });
  }
  return NextResponse.json(
    {
      ...result,
      errorArgs: result.errorArgs?.map((a) => String(a)),
      copy: errorCopy(result.errorName, result.errorArgs),
    },
    { status: 400 },
  );
}
