'use client';

import { useEffect, useState, use } from 'react';

type Claim = {
  dropId: string;
  player: string;
  tokenId: string;
  rank: number;
  supply: number;
  challengeBlock: number;
  claimBlock: number;
  txHash: string;
  chainMs?: number;
  endToEndMs?: number;
};
type Status = { dropId: string; supply: number; claimed: number; name: string; active: boolean };

export default function WallPage({ searchParams }: { searchParams: Promise<{ drop?: string }> }) {
  const { drop } = use(searchParams);
  const dropId = drop ?? process.env.NEXT_PUBLIC_ACTIVE_DROP ?? '1';

  const [claims, setClaims] = useState<Claim[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [block, setBlock] = useState(0);

  useEffect(() => {
    const es = new EventSource('/api/stream');
    es.addEventListener('block', (e) => setBlock(JSON.parse(e.data).number));
    es.addEventListener('status', (e) => {
      const s = JSON.parse(e.data) as Status;
      if (s.dropId === dropId) setStatus(s);
    });
    es.addEventListener('snapshot', (e) => {
      setClaims((JSON.parse(e.data).claims as Claim[]).filter((c) => c.dropId === dropId));
    });
    es.addEventListener('claim', (e) => {
      const c = JSON.parse(e.data) as Claim;
      if (c.dropId !== dropId) return;
      setClaims((prev) => {
        const rest = prev.filter((p) => p.tokenId !== c.tokenId);
        return [...rest, c].sort((a, b) => a.rank - b.rank);
      });
    });
    return () => es.close();
  }, [dropId]);

  const left = status ? status.supply - status.claimed : null;
  const first = claims[0];

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight">{status?.name ?? 'Flash Drop'} — the wall</h1>
          <p className="text-zinc-500 font-mono mt-1">block {block} · drop {dropId}</p>
        </div>
        {left !== null && (
          <div className={`text-right ${left <= 3 ? 'text-red-500' : 'text-emerald-400'}`}>
            <span className="text-7xl font-black tabular-nums">{left}</span>
            <span className="text-2xl text-zinc-400"> / {status!.supply} left</span>
          </div>
        )}
      </div>

      <table className="w-full text-left font-mono">
        <thead className="text-zinc-500 text-sm border-b border-zinc-800">
          <tr>
            <th className="py-2 pr-4">rank</th>
            <th className="pr-4">player</th>
            <th className="pr-4">claim block</th>
            <th className="pr-4">age (blocks)</th>
            <th className="pr-4">gap to #1</th>
            <th className="pr-4">chain</th>
            <th>end-to-end*</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => (
            <tr key={c.tokenId} className="border-b border-zinc-900 text-lg">
              <td className={`py-3 pr-4 font-black ${c.rank === 1 ? 'text-amber-400' : ''}`}>#{c.rank}</td>
              <td className="pr-4">{c.player.slice(0, 6)}…{c.player.slice(-4)}</td>
              <td className="pr-4 tabular-nums">{c.claimBlock}</td>
              <td className="pr-4 tabular-nums">{c.claimBlock - c.challengeBlock}</td>
              <td className="pr-4 tabular-nums">
                {first && c.rank !== 1 ? `+${c.claimBlock - first.claimBlock} blocks` : '—'}
              </td>
              <td className="pr-4 tabular-nums text-emerald-400">{c.chainMs != null ? `${c.chainMs}ms` : '·'}</td>
              <td className="tabular-nums text-zinc-400">{c.endToEndMs != null ? `${c.endToEndMs}ms` : '·'}</td>
            </tr>
          ))}
          {claims.length === 0 && (
            <tr>
              <td colSpan={7} className="py-10 text-zinc-600 text-center">
                no claims yet — scan the beacon
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="text-zinc-600 text-xs mt-6 font-mono">
        * end-to-end includes the phone&apos;s page load and venue Wi-Fi, not just Monad. &quot;chain&quot; is submit→receipt.
      </p>
    </main>
  );
}
