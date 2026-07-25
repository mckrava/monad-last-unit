import { EXPLORER, type ClaimFailureCode, type FailureDetail, type Hex } from '@/lib/types';

/**
 * State 3 of 3 — cases in three weights. SoldOut is heartbreak and gets the whole screen.
 * StaleChallenge is recoverable and leads with the next action. The signature/plumbing
 * failures are dull and stay visually quiet — no red boxes.
 */
export default function ClaimFailure({
  code,
  detail,
  txHash,
}: {
  code: ClaimFailureCode;
  detail?: FailureDetail;
  txHash?: Hex;
}) {
  if (code === 'SoldOut') return <SoldOut detail={detail} txHash={txHash} />;
  if (code === 'StaleChallenge') return <StaleChallenge detail={detail} />;
  if (code === 'AlreadyClaimed') return <AlreadyClaimed txHash={txHash} />;
  return <Technical code={code} txHash={txHash} />;
}

function SoldOut({ detail, txHash }: { detail?: FailureDetail; txHash?: Hex }) {
  const supply = detail?.supply;
  return (
    <main className="flex h-dvh flex-col bg-ink px-[26px] pt-[30px] pb-[36px] text-paper">
      <header className="flex items-center justify-between">
        <span className="text-[13px] font-extrabold tracking-[0.2em]">LAST UNIT</span>
        <span className="text-[13px] font-extrabold tracking-[0.2em] text-accent">SOLD OUT</span>
      </header>

      <section className="mt-[88px]">
        <h1 className="text-[128px] leading-[0.82] font-black tracking-[-0.055em]">Gone.</h1>
        <p className="mt-7 max-w-[300px] text-[30px] leading-[1.25] font-bold">
          The last unit was claimed before yours landed.
        </p>
      </section>

      <section className="mt-11 flex gap-[34px]">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-mute-dark">Claimed</p>
          <p className="mt-2 text-[68px] leading-[0.9] font-black tracking-[-0.04em]">
            {supply ?? 'ALL'}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-mute-dark">Yours</p>
          <p className="mt-2 text-[68px] leading-[0.9] font-black tracking-[-0.04em] text-accent">0</p>
        </div>
      </section>

      <footer className="mt-auto border-t border-rule-dark pt-[22px]">
        <p className="text-[15px] leading-[1.5] font-semibold text-mute-dark">
          Nothing was charged. The next drop is announced in store first — that&rsquo;s the only place it can be claimed.
        </p>
        {txHash && (
          <a
            href={`${EXPLORER}/tx/${txHash}`}
            className="mt-4 block border-b border-rule-dark font-mono text-[11px] leading-[1.5] break-all text-[#6e6b66] no-underline"
          >
            {txHash}
          </a>
        )}
      </footer>
    </main>
  );
}

function StaleChallenge({ detail }: { detail?: FailureDetail }) {
  const issued = detail?.challengeBlock;
  const arrived = issued != null && detail?.age != null ? issued + detail.age : undefined;
  return (
    <main className="flex h-dvh flex-col bg-paper px-[26px] pt-[30px] pb-[36px] text-ink">
      <header className="flex items-center justify-between">
        <span className="text-[13px] font-extrabold tracking-[0.2em]">LAST UNIT</span>
        <span className="text-[13px] font-extrabold tracking-[0.2em] text-mute">EXPIRED</span>
      </header>

      <section className="mt-20">
        <h1 className="text-[82px] leading-[0.88] font-black tracking-[-0.045em]">
          That code
          <br />
          was too
          <br />
          old.
        </h1>
        <p className="mt-[26px] max-w-[300px] text-[17px] leading-[1.5] font-semibold text-[#4a4844]">
          Nothing was claimed and nothing was lost. The screen has already issued a new one.
        </p>
      </section>

      <div className="mt-10 flex items-center justify-between border-[3px] border-ink px-[22px] py-6">
        <span className="text-[34px] font-black tracking-[-0.02em]">Scan again</span>
        <span className="text-[26px] font-extrabold text-accent">→</span>
      </div>

      <footer className="mt-auto font-mono text-[11px] leading-[1.8] text-[#9a968e]">
        {issued != null ? (
          <>
            CODE ISSUED&nbsp;&nbsp;BLOCK {issued}
            <br />
          </>
        ) : null}
        {arrived != null ? (
          <>
            YOU ARRIVED&nbsp;&nbsp;BLOCK {arrived}
            <br />
          </>
        ) : null}
        VALID FOR&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{detail?.max != null ? `${detail.max} BLOCKS` : 'SECONDS, NOT MINUTES'}
      </footer>
    </main>
  );
}

function AlreadyClaimed({ txHash }: { txHash?: Hex }) {
  return (
    <main className="flex h-dvh flex-col bg-paper px-[26px] pt-[30px] pb-[36px] text-ink">
      <header className="flex items-center justify-between">
        <span className="text-[13px] font-extrabold tracking-[0.2em]">LAST UNIT</span>
        <span className="text-[13px] font-extrabold tracking-[0.2em] text-mute">ALREADY YOURS</span>
      </header>

      <section className="mt-[84px]">
        <h1 className="text-[76px] leading-[0.9] font-black tracking-[-0.045em]">One each.</h1>
        <p className="mt-6 max-w-[300px] text-[19px] leading-[1.5] font-semibold text-[#4a4844]">
          You already claimed this drop. Nothing changed.
        </p>
      </section>

      {txHash && (
        <a
          href={`${EXPLORER}/tx/${txHash}`}
          className="mt-auto block border-b border-rule font-mono text-[11px] leading-[1.5] break-all text-mute no-underline"
        >
          {txHash}
        </a>
      )}
    </main>
  );
}

const TECHNICAL: Record<string, { tag: string; title: string; body: string; meta: string }> = {
  BadSignature: {
    tag: 'SIG_INVALID',
    title: "Signature didn't verify.",
    body: 'Nothing was claimed. Scan the screen again.',
    meta: 'NO STATE CHANGE',
  },
  UnknownCheckpoint: {
    tag: 'CP_UNKNOWN',
    title: "This code wasn't issued by this store.",
    body: 'Ask a staff member — the beacon needs pairing.',
    meta: 'NO STATE CHANGE',
  },
  DropInactive: {
    tag: 'DROP_INACTIVE',
    title: "This drop isn't live.",
    body: 'Doors soon. Watch the screen in the window.',
    meta: 'NO STATE CHANGE',
  },
  Reverted: {
    tag: 'TX_REVERT',
    title: 'The claim reverted.',
    body: 'Nothing was charged. Scan again to retry.',
    meta: 'NO UNIT ASSIGNED',
  },
};

function Technical({ code, txHash }: { code: ClaimFailureCode; txHash?: Hex }) {
  const c = TECHNICAL[code] ?? TECHNICAL.Reverted;
  return (
    <main className="flex h-dvh flex-col bg-paper px-[26px] pt-[26px] pb-[36px] text-ink">
      <div className="border-t-4 border-ink pt-[26px]">
        <p className="font-mono text-[11px] text-[#9a968e]">{c.tag}</p>
        <h1 className="mt-[18px] text-[30px] leading-[1.15] font-extrabold tracking-[-0.02em]">{c.title}</h1>
        <p className="mt-2.5 text-[14px] leading-[1.5] font-medium text-mute">{c.body}</p>
      </div>
      <footer className="mt-auto font-mono text-[11px] leading-[1.6] text-[#9a968e]">
        {txHash ? (
          <a href={`${EXPLORER}/tx/${txHash}`} className="border-b border-rule text-[#9a968e] no-underline">
            {txHash.slice(0, 6)}…{txHash.slice(-4)}
          </a>
        ) : (
          c.meta
        )}
      </footer>
    </main>
  );
}
