'use client';

import { useEffect, useRef, useState, use } from 'react';
import { QRCodeSVG } from 'qrcode.react';

type Challenge = { id: string; url: string; challengeBlock: number; dropId: string };
type Status = { dropId: string; supply: number; claimed: number; name: string; active: boolean };

export default function BeaconPage({
  params,
  searchParams,
}: {
  params: Promise<{ cpId: string }>;
  searchParams: Promise<{ drop?: string }>;
}) {
  const { cpId } = use(params);
  const { drop } = use(searchParams);
  const dropId = drop ?? process.env.NEXT_PUBLIC_ACTIVE_DROP ?? '1';

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [block, setBlock] = useState(0);
  const dead = useRef(false);

  useEffect(() => {
    dead.current = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/challenge?cpId=${cpId}&dropId=${dropId}`, { cache: 'no-store' });
        if (res.ok && !dead.current) setChallenge(await res.json());
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 1000); // rotate once per second
    return () => {
      dead.current = true;
      clearInterval(iv);
    };
  }, [cpId, dropId]);

  useEffect(() => {
    const es = new EventSource('/api/stream');
    es.addEventListener('block', (e) => setBlock(JSON.parse(e.data).number));
    es.addEventListener('status', (e) => {
      const s = JSON.parse(e.data) as Status;
      if (s.dropId === dropId) setStatus(s);
    });
    return () => es.close();
  }, [dropId]);

  const left = status ? status.supply - status.claimed : null;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-black tracking-tight uppercase">
          {status?.name ?? 'Flash Drop'}
        </h1>
        <p className="text-zinc-400 mt-2 text-xl">Scan to claim. Chain order decides.</p>
      </div>

      {left !== null && (
        <div className={`text-center ${left <= 3 ? 'text-red-500' : 'text-emerald-400'}`}>
          <span className="text-8xl font-black tabular-nums">{left}</span>
          <span className="text-3xl text-zinc-400"> / {status!.supply} left</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl">
        {challenge ? (
          <QRCodeSVG value={challenge.url} size={420} level="M" />
        ) : (
          <div className="w-[420px] h-[420px] flex items-center justify-center text-black">
            warming up…
          </div>
        )}
      </div>

      <div className="text-zinc-500 font-mono text-sm flex gap-6">
        <span>block {block}</span>
        {challenge && <span>challenge @ {challenge.challengeBlock}</span>}
        <span>checkpoint {cpId} · drop {dropId}</span>
      </div>
    </main>
  );
}
