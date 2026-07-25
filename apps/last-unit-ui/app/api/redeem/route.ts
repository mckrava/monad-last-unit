import { NextRequest, NextResponse } from 'next/server';
import { receipts } from '@/lib/receipts';
import { cashier } from '@/lib/cashier';
import { pub, CONTRACT } from '@/lib/chain';
import { lastUnitAbi } from '@/lib/abi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The receipt page refreshes the bundle every second; anything older than this
// means the holder's phone is gone (or offline) and the authorisation is dead.
const MAX_BUNDLE_AGE_MS = 15_000;

export async function POST(req: NextRequest) {
  const { code } = (await req.json()) as { code: string };

  const receipt = code ? receipts.get(code) : undefined;
  if (!receipt) {
    return NextResponse.json({ status: 'error', errorName: 'UnknownCode' }, { status: 404 });
  }
  const bundle = receipt.bundle;
  if (!bundle) {
    return NextResponse.json({ status: 'error', errorName: 'NoAuthorisation' }, { status: 400 });
  }
  if (Date.now() - bundle.updatedAt > MAX_BUNDLE_AGE_MS) {
    return NextResponse.json({ status: 'error', errorName: 'AuthorisationStale' }, { status: 400 });
  }

  const result = await cashier.redeem(
    BigInt(receipt.tokenId),
    BigInt(bundle.nonce),
    BigInt(bundle.challengeBlock),
    bundle.ownerSig,
  );

  if (result.status === 'success') {
    let dropName = '';
    try {
      const [, , , , name] = await pub.readContract({
        address: CONTRACT,
        abi: lastUnitAbi,
        functionName: 'dropStatus',
        args: [BigInt(result.dropId)],
      });
      dropName = name;
    } catch {}
    return NextResponse.json({ ...result, dropName });
  }
  return NextResponse.json(result, { status: 400 });
}
