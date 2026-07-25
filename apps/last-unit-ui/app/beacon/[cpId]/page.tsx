import Beacon from './Beacon';

export const dynamic = 'force-dynamic';

export default async function BeaconPage({
  params,
  searchParams,
}: {
  params: Promise<{ cpId: string }>;
  searchParams: Promise<{ drop?: string }>;
}) {
  const { cpId } = await params;
  const { drop } = await searchParams;
  const dropId = drop ?? process.env.NEXT_PUBLIC_ACTIVE_DROP ?? '1';
  return <Beacon cpId={cpId} dropId={dropId} />;
}
