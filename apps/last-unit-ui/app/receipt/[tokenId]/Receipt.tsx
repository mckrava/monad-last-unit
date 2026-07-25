'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Receipt — /receipt/[tokenId]. What the buyer shows at the counter.
 * A 6-digit code the cashier TYPES (no QR, no camera). The code is stable, but the
 * signature bundle behind it rotates every second from this phone — a code read over
 * someone's shoulder is worthless unless this phone is present and still refreshing.
 */

type Opened = { code: string; rank: number; supply: number; dropName: string };
type Phase =
  | { s: 'loading' }
  | { s: 'foreign' } // no key on this device, or the key doesn't own the token
  | { s: 'gone' }
  | { s: 'live'; opened: Opened };

export default function Receipt({ tokenId }: { tokenId: string }) {
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [beat, setBeat] = useState(0); // increments on each successful refresh
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let stop = false;
    let es: EventSource | null = null;

    (async () => {
      const [{ privateKeyToAccount }, { encodeAbiParameters, keccak256, parseAbiParameters }] =
        await Promise.all([import('viem/accounts'), import('viem')]);

      let pk: `0x${string}` | null = null;
      try {
        pk = localStorage.getItem('lastunit:pk:v1') as `0x${string}` | null;
      } catch {}
      if (!pk) {
        setPhase({ s: 'foreign' });
        return;
      }
      const account = privateKeyToAccount(pk);

      const res = await fetch('/api/receipt/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId, player: account.address }),
      });
      if (res.status === 403) return setPhase({ s: 'foreign' });
      if (!res.ok) return setPhase({ s: 'gone' });
      const opened = (await res.json()) as Opened;
      setPhase({ s: 'live', opened });

      // current proposed block, from the same SSE feed the wall uses
      let block = 0;
      es = new EventSource('/api/stream');
      es.addEventListener('block', (e) => {
        block = JSON.parse(e.data).number;
      });

      const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT as `0x${string}`;
      const CHAIN_ID = BigInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? '10143');

      const refresh = async () => {
        if (stop || !block) return;
        try {
          const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
          const nonce = BigInt(
            '0x' + Array.from(nonceBytes, (b) => b.toString(16).padStart(2, '0')).join(''),
          );
          // must match LastUnit.redeemHash: uint8(1) domain separator keeps claim
          // signatures structurally unusable as redemption authorisations
          const hash = keccak256(
            encodeAbiParameters(
              parseAbiParameters('uint256, address, uint8, uint256, uint256, uint256'),
              [CHAIN_ID, CONTRACT, 1, BigInt(tokenId), nonce, BigInt(block)],
            ),
          );
          const ownerSig = await account.signMessage({ message: { raw: hash } });
          const r = await fetch('/api/receipt/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: opened.code, nonce: String(nonce), challengeBlock: block, ownerSig }),
          });
          if (r.ok) setBeat((b) => b + 1);
        } catch {}
      };

      refresh();
      const t = setInterval(refresh, 1000);
      const cleanup = () => {
        stop = true;
        clearInterval(t);
        es?.close();
      };
      window.addEventListener('beforeunload', cleanup);
    })();

    return () => {
      stop = true;
      es?.close();
    };
  }, [tokenId]);

  if (phase.s === 'loading') {
    return (
      <main className="flex h-dvh flex-col items-center justify-center bg-paper text-ink">
        <span className="anim-beat size-[9px] rounded-full bg-accent" />
      </main>
    );
  }

  if (phase.s === 'foreign') {
    return (
      <main className="flex h-dvh flex-col bg-paper px-[26px] pt-[30px] pb-[36px] text-ink">
        <header className="flex items-center justify-between">
          <span className="text-[13px] font-extrabold tracking-[0.2em]">LAST UNIT</span>
          <span className="text-[13px] font-extrabold tracking-[0.2em] text-mute">NOT YOURS</span>
        </header>
        <section className="mt-24">
          <h1 className="text-[64px] leading-[0.92] font-black tracking-[-0.045em]">
            This receipt
            <br />
            belongs to
            <br />
            another device.
          </h1>
          <p className="mt-6 max-w-[300px] text-[17px] leading-[1.5] font-semibold text-[#4a4844]">
            The unit is bound to the phone that claimed it. Only that phone can authorise pickup.
          </p>
        </section>
      </main>
    );
  }

  if (phase.s === 'gone') {
    return (
      <main className="flex h-dvh flex-col bg-paper px-[26px] pt-[30px] pb-[36px] text-ink">
        <header className="flex items-center justify-between">
          <span className="text-[13px] font-extrabold tracking-[0.2em]">LAST UNIT</span>
          <span className="text-[13px] font-extrabold tracking-[0.2em] text-mute">REDEEMED</span>
        </header>
        <section className="mt-24">
          <h1 className="text-[76px] leading-[0.9] font-black tracking-[-0.045em]">Picked up.</h1>
          <p className="mt-6 max-w-[300px] text-[17px] leading-[1.5] font-semibold text-[#4a4844]">
            This unit was already redeemed at the counter. Nothing left to show.
          </p>
        </section>
      </main>
    );
  }

  const { opened } = phase;
  return (
    <main className="flex h-dvh flex-col bg-paper px-[26px] pt-[30px] pb-[36px] text-ink">
      <header className="flex items-center justify-between">
        <span className="text-[13px] font-extrabold tracking-[0.2em]">LAST UNIT</span>
        <span className="bg-ink px-2 py-[5px] text-[13px] font-extrabold tracking-[0.2em] text-paper">PICKUP</span>
      </header>

      <section className="mt-[44px]">
        <p className="text-[12px] font-semibold tracking-[0.18em] uppercase text-mute">Show this at the counter</p>
        <h1 className="mt-3 text-[30px] leading-[1.1] font-black tracking-[-0.02em]">{opened.dropName}</h1>
        <p className="mt-2 text-[12px] font-semibold tracking-[0.16em] uppercase text-mute">
          #{opened.rank} of {opened.supply} · token {tokenId}
        </p>
      </section>

      <section className="mt-14 border-y-[3px] border-ink py-10 text-center">
        <p className="font-mono text-[64px] font-bold tracking-[0.18em]">
          {opened.code.slice(0, 3)}
          <span className="text-mute"> </span>
          {opened.code.slice(3)}
        </p>
      </section>

      <section className="mt-8 flex items-center gap-3">
        <span key={beat} className="anim-beat size-[9px] shrink-0 rounded-full bg-accent" />
        <p className="text-[12px] font-semibold tracking-[0.18em] uppercase text-mute">
          Authorisation live · re-signed every second
        </p>
      </section>

      <footer className="mt-auto font-mono text-[11px] leading-[1.6] text-[#9a968e]">
        THE CODE ONLY WORKS WHILE THIS SCREEN IS OPEN.
        <br />A COPY IS WORTHLESS WITHOUT THIS PHONE.
      </footer>
    </main>
  );
}
