import Link from 'next/link';
import { DROP } from '@/lib/types';

export default function Home() {
  const drop = process.env.NEXT_PUBLIC_ACTIVE_DROP ?? '1';
  const cp = process.env.NEXT_PUBLIC_CHECKPOINT ?? '1';
  return (
    <main className="flex min-h-dvh flex-col bg-paper px-[26px] pt-[30px] pb-[36px] text-ink">
      <header className="flex items-center justify-between">
        <span className="text-[13px] font-extrabold tracking-[0.2em]">LAST UNIT</span>
        <span className="text-[13px] font-extrabold tracking-[0.2em] text-mute">{DROP.venue}</span>
      </header>

      <section className="mt-20">
        <h1 className="text-[64px] leading-[0.9] font-black tracking-[-0.045em]">
          Claimed in store.
          <br />
          In the order
          <br />
          they land.
        </h1>
        <p className="mt-6 max-w-[340px] text-[17px] leading-[1.5] font-semibold text-[#4a4844]">
          {DROP.name} {DROP.edition}. A new code every second, signed by the display.
          Monad&rsquo;s ordering decides who gets the last unit.
        </p>
      </section>

      <section className="mt-14 flex flex-col gap-4">
        <Link href={`/beacon/${cp}?drop=${drop}`} className="flex items-center justify-between border-[3px] border-ink px-[22px] py-6 no-underline">
          <span className="text-[28px] font-black tracking-[-0.02em] text-ink">Beacon display</span>
          <span className="text-[24px] font-extrabold text-accent">→</span>
        </Link>
        <Link href={`/wall?drop=${drop}`} className="flex items-center justify-between border-[3px] border-ink px-[22px] py-6 no-underline">
          <span className="text-[28px] font-black tracking-[-0.02em] text-ink">The wall</span>
          <span className="text-[24px] font-extrabold text-accent">→</span>
        </Link>
      </section>

      <footer className="mt-auto pt-10 font-mono text-[11px] leading-[1.6] text-[#9a968e]">
        MONAD TESTNET · CHAIN 10143 · ~300MS BLOCKS
      </footer>
    </main>
  );
}
