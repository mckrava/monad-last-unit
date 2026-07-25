'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DROP } from '@/lib/types';
import { block as fmtBlock } from '@/lib/format';

type Challenge = { id: string; url: string; challengeBlock: number };
type Status = { dropId: string; supply: number; claimed: number; name: string };

/**
 * Beacon display — /beacon/[cpId]?drop=N
 * Works portrait (tablet in the window) and landscape (monitor); same design, two crops.
 *
 * QR rules, non-negotiable:
 *  - dark modules on a light panel, never inverted
 *  - >= 4 modules of quiet zone (QRCodeSVG marginSize={4})
 *  - nothing animated, overlaid or drawn on top of the code
 *  - liveness lives BESIDE the code: the sweep bar, the seq counter, the block number
 */
export default function Beacon({ cpId, dropId }: { cpId: string; dropId: string }) {
  const [seq, setSeq] = useState(0);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [block, setBlock] = useState(0);
  const dead = useRef(false);

  // One-second cadence: the whole product's heartbeat. Each tick fetches a
  // freshly beacon-signed challenge; the QR encodes only the short claim URL.
  useEffect(() => {
    dead.current = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/challenge?cpId=${cpId}&dropId=${dropId}`, { cache: 'no-store' });
        if (res.ok && !dead.current) {
          setChallenge(await res.json());
          setSeq((s) => s + 1);
        }
      } catch {}
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => {
      dead.current = true;
      clearInterval(t);
    };
  }, [cpId, dropId]);

  // Real chain texture: proposed-block feed over SSE, plus live supply.
  useEffect(() => {
    const es = new EventSource(`/api/stream?drop=${dropId}`);
    es.addEventListener('block', (e) => setBlock(JSON.parse(e.data).number));
    es.addEventListener('status', (e) => {
      const s = JSON.parse(e.data) as Status;
      if (String(s.dropId) === String(dropId)) setStatus(s);
    });
    return () => es.close();
  }, [dropId]);

  return (
    <main className="flex h-dvh w-screen flex-col overflow-hidden p-[3vmin] landscape:flex-row landscape:gap-[4vmin] bg-paper text-ink">
      {/* Copy column */}
      <section className="flex flex-col landscape:flex-1">
        <div className="flex items-baseline justify-between gap-6">
          <span className="text-[4.2vmin] font-black tracking-[-0.03em]">LAST UNIT</span>
          <span className="text-[2.3vmin] font-semibold tracking-[0.16em] text-mute">{DROP.venue}</span>
        </div>

        <h1 className="mt-[3vmin] text-[6.4vmin] leading-[0.98] font-black tracking-[-0.04em]">
          {status ? status.name : `${DROP.name} ${DROP.edition}`}
        </h1>

        {/* never a partial string: full "N OF M LEFT" only once status has loaded */}
        <div className="mt-[2.5vmin] flex items-baseline gap-[2vmin]">
          {status ? (
            <>
              <span className="text-[14vmin] leading-[0.8] font-black tracking-[-0.055em] text-accent">
                {status.supply - status.claimed}
              </span>
              <span className="text-[5vmin] font-bold">OF {status.supply} LEFT</span>
            </>
          ) : (
            <span className="text-[14vmin] leading-[0.8] font-black tracking-[-0.055em] text-mute">—</span>
          )}
        </div>

        <div className="mt-auto hidden landscape:block">
          <p className="text-[4.4vmin] leading-[1.1] font-bold tracking-[-0.02em]">
            Point your camera.
            <br />
            New code every second.
          </p>
          <div className="mt-[2vmin] flex gap-[3vmin] font-mono text-[2.3vmin] text-mute">
            <span>CODE #{4400 + (seq % 600)}</span>
            <span>
              BLOCK <span className="text-ink">{fmtBlock(block)}</span>
            </span>
          </div>
        </div>
      </section>

      {/* QR column */}
      <section className="flex min-h-0 flex-col landscape:w-[46vw]">
        <div className="mt-[3vmin] flex min-h-0 flex-1 border-[0.35vmin] border-ink bg-white p-[2.4vmin] landscape:mt-0">
          {/* key={id} remounts the code once per second: a swap, cushioned by a short fade — not a flicker */}
          {challenge ? (
            <div key={challenge.id} className="anim-qr grid aspect-square min-h-0 w-full place-items-center">
              <QRCodeSVG value={challenge.url} level="M" marginSize={4} bgColor="#FFFFFF" fgColor="#101012" className="h-full w-full" />
            </div>
          ) : (
            <div className="grid aspect-square min-h-0 w-full place-items-center font-mono text-[2vmin] text-mute">
              SIGNING FIRST CODE…
            </div>
          )}
        </div>

        {/* Liveness, beside the code and never over it */}
        <div className="mt-[2vmin] h-[1.4vmin] overflow-hidden bg-rule">
          <div key={seq} className="anim-sweep h-full bg-accent" />
        </div>

        <div className="mt-[2.4vmin] flex items-end justify-between landscape:hidden">
          <div>
            <p className="text-[4vmin] leading-[1.1] font-bold tracking-[-0.02em]">
              Point your camera.
              <br />
              New code every second.
            </p>
            <p className="mt-[2vmin] text-[2.3vmin] font-semibold tracking-[0.16em] text-mute">
              CODE #{4400 + (seq % 600)} · EXPIRES IN UNDER A SECOND
            </p>
          </div>
          <p className="text-right font-mono text-[2.3vmin] leading-[1.4] text-mute">
            BLOCK
            <br />
            <span className="text-[3vmin] text-ink">{fmtBlock(block)}</span>
          </p>
        </div>
      </section>
    </main>
  );
}
