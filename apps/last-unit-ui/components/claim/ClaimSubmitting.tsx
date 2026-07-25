'use client';

import { useEffect, useState } from 'react';
import { DROP } from '@/lib/types';

/** State 1 of 3 — under ~2 seconds. Motion and stakes, no generic spinner. */
export default function ClaimSubmitting({ remaining, supply }: { remaining: number | null; supply?: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // from navigation start, not mount: page load is part of the race
    const t = setInterval(() => setElapsed(performance.now()), 80);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="flex h-dvh flex-col bg-paper px-[26px] pt-[30px] pb-[36px] text-ink">
      <header className="flex items-center justify-between">
        <span className="text-[13px] font-extrabold tracking-[0.2em]">LAST UNIT</span>
        <span className="anim-beat size-[9px] rounded-full bg-accent" />
      </header>

      <section className="mt-24">
        <h1 className="text-[76px] leading-[0.9] font-black tracking-[-0.045em]">Claiming</h1>
        <div className="mt-[22px] h-2 overflow-hidden bg-rule">
          <div className="anim-race h-full w-1/4 bg-accent" />
        </div>
        <p className="mt-[26px] text-[12px] font-semibold tracking-[0.18em] uppercase text-mute">
          Signing and submitting · don&rsquo;t close this
        </p>
      </section>

      <section className="mt-16 border-t border-rule pt-[26px]">
        <p className="text-[12px] font-semibold tracking-[0.18em] uppercase text-mute">Left right now</p>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-[104px] leading-[0.82] font-black tracking-[-0.05em] text-accent">
            {remaining ?? '·'}
          </span>
          <span className="text-[30px] font-bold">of {supply ?? DROP.supply}</span>
        </div>
      </section>

      <footer className="mt-auto flex items-baseline justify-between font-mono text-[13px] text-mute">
        <span>ELAPSED</span>
        <span className="text-[22px] text-ink">{(elapsed / 1000).toFixed(1)}s</span>
      </footer>
    </main>
  );
}
