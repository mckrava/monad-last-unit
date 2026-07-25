import Link from 'next/link';

export default function Home() {
  const drop = process.env.NEXT_PUBLIC_ACTIVE_DROP ?? '1';
  const cp = process.env.NEXT_PUBLIC_CHECKPOINT ?? '1';
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6">
      <h1 className="text-5xl font-black uppercase">doorbuster</h1>
      <p className="text-zinc-400">verified-presence flash drop on Monad</p>
      <div className="flex gap-4 font-mono">
        <Link className="border border-zinc-700 rounded-lg px-6 py-3 hover:bg-zinc-900" href={`/beacon/${cp}?drop=${drop}`}>
          beacon →
        </Link>
        <Link className="border border-zinc-700 rounded-lg px-6 py-3 hover:bg-zinc-900" href={`/wall?drop=${drop}`}>
          wall →
        </Link>
      </div>
    </main>
  );
}
