import { beacon } from '@/lib/beacon';
import ClaimClient from './claim-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challenge = beacon.get(id);

  if (!challenge) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center gap-4">
        <h1 className="text-4xl font-black">This code has expired</h1>
        <p className="text-zinc-400 text-lg">
          Codes rotate every second and die fast. Go back to the display and scan the live one.
        </p>
      </main>
    );
  }

  return (
    <ClaimClient
      id={challenge.id}
      dropId={String(challenge.dropId)}
      challengeHash={challenge.challengeHash}
    />
  );
}
