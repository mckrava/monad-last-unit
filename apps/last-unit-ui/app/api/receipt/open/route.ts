import { NextRequest, NextResponse } from 'next/server';
import { receipts } from '@/lib/receipts';
import { pub, CONTRACT } from '@/lib/chain';
import { lastUnitAbi } from '@/lib/abi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { tokenId, player } = (await req.json()) as { tokenId: string; player: `0x${string}` };
  if (!tokenId || !player) return NextResponse.json({ error: 'BadRequest' }, { status: 400 });

  let holder: string;
  try {
    holder = await pub.readContract({
      address: CONTRACT,
      abi: lastUnitAbi,
      functionName: 'ownerOf',
      args: [BigInt(tokenId)],
    });
  } catch {
    // ownerOf reverts for burned or never-minted tokens
    return NextResponse.json({ error: 'TokenGone' }, { status: 404 });
  }
  if (holder.toLowerCase() !== player.toLowerCase()) {
    return NextResponse.json({ error: 'NotOwner' }, { status: 403 });
  }

  const dropId = BigInt(tokenId) / 1_000_000n;
  const rank = Number(BigInt(tokenId) % 1_000_000n);
  const [supply, , , , name] = await pub.readContract({
    address: CONTRACT,
    abi: lastUnitAbi,
    functionName: 'dropStatus',
    args: [dropId],
  });

  const receipt = receipts.open(tokenId, player);
  return NextResponse.json({ code: receipt.code, rank, supply, dropName: name, dropId: String(dropId) });
}
