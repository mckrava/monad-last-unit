'use client';

import { useEffect, useRef, useState } from 'react';

type Result =
  | { status: 'success'; rank: number; tokenId: string; txHash: string; blockNumber: number; chainMs: number; endToEndMs: number; explorerUrl: string }
  | { status: 'error'; errorName: string; copy: string };

export default function ClaimClient({
  id,
  dropId,
  challengeHash,
}: {
  id: string;
  dropId: string;
  challengeHash: `0x${string}`;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return; // survive React strict-mode double mount
    fired.current = true;

    (async () => {
      try {
        // ephemeral key: generated in memory, never persisted, one per page load
        const [{ generatePrivateKey, privateKeyToAccount }, { encodeAbiParameters, keccak256, parseAbiParameters }] =
          await Promise.all([import('viem/accounts'), import('viem')]);
        const account = privateKeyToAccount(generatePrivateKey());
        const playerHashValue = keccak256(
          encodeAbiParameters(parseAbiParameters('bytes32, uint256'), [challengeHash, BigInt(dropId)]),
        );
        const playerSig = await account.signMessage({ message: { raw: playerHashValue } });
        const clientElapsedMs = Math.round(performance.now());

        const res = await fetch('/api/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, playerSig, clientElapsedMs }),
        });
        const json = await res.json();
        setResult(json);
      } catch (e: any) {
        setResult({ status: 'error', errorName: 'ClientError', copy: 'Something broke. Reload and scan again.' });
      }
    })();
  }, [id, dropId, challengeHash]);

  if (!result) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 gap-6">
        <div className="animate-pulse text-6xl">⚡</div>
        <h1 className="text-3xl font-black">Racing for it…</h1>
        <p className="text-zinc-400">Your claim is on its way to the chain.</p>
      </main>
    );
  }

  if (result.status === 'success') {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 gap-5 text-center">
        <div className="text-7xl">🏆</div>
        <h1 className="text-6xl font-black text-emerald-400">#{result.rank}</h1>
        <p className="text-2xl font-bold">You got one.</p>
        <div className="text-zinc-400 font-mono text-sm flex flex-col gap-1">
          <span>token {result.tokenId} · block {result.blockNumber}</span>
          <span>chain: {result.chainMs}ms · end-to-end: {result.endToEndMs}ms</span>
        </div>
        <a href={result.explorerUrl} target="_blank" className="text-emerald-400 underline text-sm">
          view transaction
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 gap-5 text-center">
      <div className="text-7xl">💨</div>
      <h1 className="text-4xl font-black text-red-500">Missed it</h1>
      <p className="text-xl text-zinc-300 max-w-md">{(result as any).copy ?? 'Claim failed.'}</p>
    </main>
  );
}
