import { beacon } from '@/lib/beacon';
import { watcher } from '@/lib/watcher';
import Claim from './Claim';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const challenge = beacon.get(id);

  if (!challenge) {
    // server restarted or the QR is very old — same verdict as on-chain staleness
    return <Claim id={id} expired />;
  }

  const status = watcher.state.statuses[String(challenge.dropId)];
  return (
    <Claim
      id={id}
      dropId={String(challenge.dropId)}
      challengeHash={challenge.challengeHash}
      challengeBlock={Number(challenge.challengeBlock)}
      supply={status?.supply}
      claimed={status?.claimed}
    />
  );
}
