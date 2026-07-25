import { DROP, EXPLORER, type Claim, type Hex } from '@/lib/types';
import { chainShare, ms } from '@/lib/format';

/**
 * State 2 of 3 — the payoff, and the screen that gets photographed.
 * The two timings are never conflated: endToEndMs is the whole bar (phone + venue Wi-Fi + chain),
 * chainMs is the shaded segment inside it. Same bar, containment made literal.
 */
export default function ClaimSuccess({ claim, txHash }: { claim: Claim; txHash: Hex }) {
  const onChain = chainShare(claim.chainMs, claim.endToEndMs);

  return (
    <main className="flex h-dvh flex-col bg-paper px-[26px] pt-[30px] pb-[36px] text-ink">
      <header className="flex items-center justify-between">
        <span className="text-[13px] font-extrabold tracking-[0.2em]">LAST UNIT</span>
        <span className="bg-ink px-2 py-[5px] text-[13px] font-extrabold tracking-[0.2em] text-paper">YOURS</span>
      </header>

      <section className="mt-[52px]">
        <p className="text-[12px] font-semibold tracking-[0.18em] uppercase text-mute">You got one</p>
        <div className="mt-3.5 flex items-baseline gap-2.5">
          <span className="text-[170px] leading-[0.78] font-black tracking-[-0.06em]">#{claim.rank}</span>
          <span className="text-[38px] font-bold text-mute">of {claim.supply}</span>
        </div>
        <h1 className="mt-[22px] text-[34px] leading-[1.1] font-black tracking-[-0.02em]">
          {DROP.name} {DROP.edition}
        </h1>
        <p className="mt-2.5 text-[12px] font-semibold tracking-[0.16em] uppercase text-mute">
          {DROP.venue} · token {claim.tokenId}
        </p>
      </section>

      <section className="mt-auto border-t border-rule pt-[22px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-semibold tracking-[0.16em] uppercase text-mute">Scan → confirmed</span>
          <span className="text-[46px] leading-none font-black tracking-[-0.03em]">
            {ms(claim.endToEndMs)}
          </span>
        </div>

        <div className="mt-3 flex h-4 border-[1.5px] border-ink">
          <div style={{ flex: `${100 - onChain} 1 0` }} />
          <div className="bg-accent" style={{ flex: `${onChain} 1 0` }} />
        </div>
        <div className="mt-[9px] flex justify-between font-mono text-[11px]">
          <span className="text-mute">YOUR PHONE + SHOP WI-FI</span>
          <span className="text-accent">ON CHAIN</span>
        </div>

        <div className="mt-4 flex items-baseline justify-between border-t border-rule pt-4">
          <span className="text-[12px] font-semibold tracking-[0.16em] uppercase text-mute">Of which on chain</span>
          <span className="text-[26px] font-extrabold text-accent">{ms(claim.chainMs)}</span>
        </div>
        <p className="mt-4 font-mono text-[11px] leading-[1.5] text-[#9a968e]">
          SUBMIT → RECEIPT, BLOCK {claim.challengeBlock} → {claim.claimBlock}
        </p>

        <a
          href={`/receipt/${claim.tokenId}`}
          className="mt-5 flex items-center justify-between border-[3px] border-ink px-[22px] py-5 no-underline"
        >
          <span className="text-[26px] font-black tracking-[-0.02em] text-ink">Pick up in store</span>
          <span className="text-[22px] font-extrabold text-accent">→</span>
        </a>

        <a
          href={`${EXPLORER}/tx/${txHash}`}
          className="mt-4 block border-b border-rule font-mono text-[11px] leading-[1.5] break-all text-mute no-underline"
        >
          {txHash}
        </a>
      </section>
    </main>
  );
}
