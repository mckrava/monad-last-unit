'use client';

import { useEffect, useState } from 'react';
import { DROP } from '@/lib/types';
import { block as fmtBlock, ms, shortAddr } from '@/lib/format';

/**
 * Wall — /wall?drop=N. Portrait large screen, 5–10 m viewing distance, never scrolls.
 * Fed live: proposed blocks ~3/s, Claimed events, and supply over SSE.
 */

const TIGHT_GAP = 3; // blocks. At or under this, the row reads hot.
const MAX_ROWS = 11; // fixed viewport: show the newest rows only

type WallClaim = {
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
type Status = { dropId: string; supply: number; claimed: number; name: string };

const COLS = 'grid-cols-[130px_1fr_150px_165px_200px]';

export default function Wall({ dropId }: { dropId: string }) {
  const [block, setBlock] = useState(0);
  const [claims, setClaims] = useState<WallClaim[]>([]);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/stream');
    es.addEventListener('block', (e) => setBlock(JSON.parse(e.data).number));
    es.addEventListener('status', (e) => {
      const s = JSON.parse(e.data) as Status;
      if (s.dropId === dropId) setStatus(s);
    });
    es.addEventListener('snapshot', (e) => {
      setClaims(
        (JSON.parse(e.data).claims as WallClaim[])
          .filter((c) => c.dropId === dropId)
          .sort((a, b) => a.rank - b.rank),
      );
    });
    es.addEventListener('claim', (e) => {
      const c = JSON.parse(e.data) as WallClaim;
      if (c.dropId !== dropId) return;
      setClaims((prev) => [...prev.filter((p) => p.tokenId !== c.tokenId), c].sort((a, b) => a.rank - b.rank));
    });
    return () => es.close();
  }, [dropId]);

  const supply = status?.supply ?? DROP.supply;
  const remaining = status ? Math.max(0, status.supply - status.claimed) : null;
  const lastOne = remaining === 1;
  const soldOut = remaining === 0 && claims.length > 0;

  // block gap: rank 1 runs against its challenge; everyone after runs against the previous claim
  const rows = claims.map((c, i) => ({
    ...c,
    gap: i === 0 ? c.claimBlock - c.challengeBlock : c.claimBlock - claims[i - 1].claimBlock,
  }));
  const visible = rows.slice(-MAX_ROWS);

  return (
    <main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-paper text-ink">
      <header className="flex items-center justify-between border-b-[3px] border-ink px-14 py-11">
        <div className="flex items-baseline gap-6">
          <span className="text-[44px] font-black tracking-[-0.03em]">LAST UNIT</span>
          <span className="text-[24px] font-semibold tracking-[0.16em] text-mute">{DROP.venue}</span>
        </div>
        <div className="flex items-center gap-[18px]">
          <span className="text-[24px] font-semibold tracking-[0.16em] text-mute">BLOCK</span>
          <span className="font-mono text-[34px] font-medium">{fmtBlock(block)}</span>
          <span className="anim-beat size-4 rounded-full bg-accent" />
        </div>
      </header>

      <section className="flex items-end justify-between gap-10 px-14 pt-11 pb-[30px]">
        <div className="shrink-0">
          <p className="mb-3.5 text-[26px] font-semibold tracking-[0.2em] uppercase text-mute">Units left</p>
          <div className="flex items-baseline gap-5">
            <span className={`text-[300px] leading-[0.76] font-black tracking-[-0.06em] ${remaining !== null && remaining <= 3 ? 'text-accent' : 'text-ink'}`}>
              {remaining ?? '·'}
            </span>
            <span className="shrink-0 text-[44px] font-bold whitespace-nowrap text-mute">/ {supply}</span>
          </div>
        </div>
        <div className="basis-[440px] shrink-0 grow-0 pb-[30px] text-right">
          <p className="text-[46px] leading-[1.05] font-black tracking-[-0.03em]">
            {DROP.name}
            <br />
            {DROP.edition}
          </p>
          <p className="mt-3 text-[22px] leading-[1.5] font-semibold tracking-[0.1em] text-mute">
            {supply} UNITS · CLAIMED IN STORE
          </p>
        </div>
      </section>

      {lastOne && (
        <div className="anim-one-left mx-14 mb-[26px] flex items-center justify-between px-7 py-5 text-paper">
          <span className="text-[54px] font-black tracking-[-0.02em]">ONE LEFT</span>
          <span className="text-[28px] font-semibold tracking-[0.14em]">SOMEONE IN THE ROOM IS ABOUT TO GET IT</span>
        </div>
      )}

      <div className={`grid ${COLS} gap-4 border-t border-ink px-14 pt-[18px] pb-3.5 text-[22px] font-semibold tracking-[0.16em] uppercase text-mute`}>
        <div>Rank</div>
        <div>Claimed by</div>
        <div className="text-right">On chain</div>
        <div className="text-right">Scan → done</div>
        <div className="text-right">Block gap</div>
      </div>

      {/* column-reverse keeps DOM keys stable, so only the new row animates in */}
      <div className="flex flex-1 flex-col-reverse justify-end overflow-hidden px-14">
        {visible.length === 0 && (
          <div className="py-10 text-[26px] font-semibold tracking-[0.16em] uppercase text-mute">
            No claims yet · scan the code in the window
          </div>
        )}
        {visible.map((r, i) => {
          const tight = r.gap <= TIGHT_GAP;
          const newest = i === visible.length - 1;
          return (
            <div key={r.tokenId} className={`anim-row grid ${COLS} items-center gap-4 border-b border-rule py-5`}>
              <div className={`text-[48px] leading-none font-black tracking-[-0.04em] ${newest ? 'text-accent' : 'text-ink'}`}>
                #{r.rank}
              </div>
              <div className="font-mono text-[28px] font-medium whitespace-nowrap">{shortAddr(r.player)}</div>
              <div className="text-right text-[30px] font-semibold whitespace-nowrap text-mute">
                {r.chainMs != null ? ms(r.chainMs) : '—'}
              </div>
              <div className="text-right text-[36px] font-extrabold whitespace-nowrap">
                {r.endToEndMs != null ? ms(r.endToEndMs) : '—'}
              </div>
              <div className="flex items-center justify-end gap-3.5">
                <div
                  className={`h-3 shrink-0 ${tight ? 'bg-accent' : 'bg-[#b3afa6]'}`}
                  style={{ width: `${Math.min(92, 5 + r.gap * 5)}px` }}
                />
                <div className={`w-[88px] shrink-0 text-right text-[28px] font-extrabold ${tight ? 'text-accent' : 'text-[#b3afa6]'}`}>
                  +{r.gap}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="flex items-end justify-between border-t-[3px] border-ink px-14 pt-[34px] pb-10">
        <p className="max-w-[640px] text-[40px] leading-[1.1] font-black tracking-[-0.025em]">
          You were standing there.
          <br />
          They weren&rsquo;t. That&rsquo;s why you got it.
        </p>
        <p className="text-right font-mono text-[22px] leading-[1.5] font-semibold text-mute">
          LIVE ON MONAD
          <br />
          ~300MS BLOCKS
        </p>
      </footer>

      {soldOut && (
        <div className="absolute inset-0 flex flex-col justify-center gap-9 bg-ink px-16 py-20 text-paper">
          <p className="text-[30px] font-semibold tracking-[0.24em] text-accent">{DROP.name}</p>
          <p className="text-[260px] leading-[0.82] font-black tracking-[-0.06em]">
            ALL
            <br />
            GONE
          </p>
          <p className="text-[46px] leading-[1.3] font-bold">{supply} of {supply} claimed</p>
          <p className="max-w-[800px] text-[30px] leading-[1.5] font-semibold text-mute-dark">
            Every unit went to a phone that was inside the store.
          </p>
        </div>
      )}
    </main>
  );
}
