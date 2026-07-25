'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Cashier terminal — /cashier. Desktop, single input, no auth (deliberate demo
 * shortcut, named in the pitch alongside the others). Types the 6-digit code from
 * the customer's receipt; submits automatically on the 6th digit.
 */

type Verdict =
  | { s: 'idle' }
  | { s: 'busy' }
  | { s: 'ok'; dropName: string; rank: number }
  | { s: 'fail'; message: string };

const FAIL_COPY: Record<string, string> = {
  TokenGone: 'Already redeemed.',
  NotTokenOwner: 'Authorisation invalid — ask the customer to reopen their receipt.',
  StaleChallenge: 'Authorisation expired — ask the customer to reopen their receipt.',
  AuthorisationStale: 'Authorisation expired — ask the customer to reopen their receipt.',
  NoAuthorisation: 'Receipt not live — ask the customer to open it on their phone.',
  UnknownCode: 'No such code.',
};

export default function CashierPage() {
  const [digits, setDigits] = useState('');
  const [verdict, setVerdict] = useState<Verdict>({ s: 'idle' });
  const [count, setCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [verdict.s]);

  useEffect(() => {
    if (digits.length !== 6 || verdict.s === 'busy') return;
    const code = digits;
    setVerdict({ s: 'busy' });
    (async () => {
      try {
        const res = await fetch('/api/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const json = await res.json();
        if (json.status === 'success') {
          setCount((c) => c + 1);
          setVerdict({ s: 'ok', dropName: json.dropName || 'LAST UNIT', rank: json.rank });
          setTimeout(() => {
            setVerdict({ s: 'idle' });
            setDigits('');
            inputRef.current?.focus();
          }, 4000);
        } else {
          setVerdict({ s: 'fail', message: FAIL_COPY[json.errorName] ?? `Redemption failed: ${json.errorName}` });
          setDigits('');
        }
      } catch {
        setVerdict({ s: 'fail', message: 'Network error — try again.' });
        setDigits('');
      }
    })();
  }, [digits, verdict.s]);

  if (verdict.s === 'ok') {
    return (
      <main className="flex h-dvh flex-col justify-center bg-ink px-16 text-paper">
        <p className="text-[24px] font-semibold tracking-[0.24em] text-accent">REDEEMED</p>
        <h1 className="mt-6 text-[140px] leading-[0.85] font-black tracking-[-0.05em]">
          HAND
          <br />
          OVER
        </h1>
        <p className="mt-8 text-[40px] font-bold">
          {verdict.dropName} <span className="text-accent">#{verdict.rank}</span>
        </p>
        <p className="mt-4 text-[18px] font-semibold text-mute-dark">Clearing in a moment…</p>
      </main>
    );
  }

  return (
    <main className="flex h-dvh flex-col bg-paper px-16 pt-12 pb-10 text-ink">
      <header className="flex items-center justify-between">
        <span className="text-[18px] font-extrabold tracking-[0.2em]">LAST UNIT · COUNTER</span>
        <span className="font-mono text-[16px] text-mute">
          REDEEMED THIS SESSION: <span className="text-ink">{count}</span>
        </span>
      </header>

      <section className="mx-auto mt-[16vh] w-full max-w-[640px]">
        <p className="text-[14px] font-semibold tracking-[0.18em] uppercase text-mute">
          Type the 6-digit code from the customer&rsquo;s phone
        </p>
        <input
          ref={inputRef}
          value={digits}
          onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoFocus
          disabled={verdict.s === 'busy'}
          className="mt-5 w-full border-[4px] border-ink bg-white px-8 py-7 font-mono text-[72px] font-bold tracking-[0.3em] outline-none disabled:opacity-50"
          placeholder="——————"
        />
        {verdict.s === 'busy' && (
          <div className="mt-5 h-2 overflow-hidden bg-rule">
            <div className="anim-race h-full w-1/4 bg-accent" />
          </div>
        )}
        {verdict.s === 'fail' && (
          <p className="mt-5 text-[22px] font-bold text-accent">{verdict.message}</p>
        )}
      </section>

      <footer className="mt-auto font-mono text-[12px] leading-[1.6] text-[#9a968e]">
        BURNS THE TOKEN ON MONAD · NO AUTH ON THIS PAGE (DEMO SHORTCUT)
      </footer>
    </main>
  );
}
