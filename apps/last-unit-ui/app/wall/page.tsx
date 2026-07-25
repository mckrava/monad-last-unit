import Wall from './Wall';

export const dynamic = 'force-dynamic';

export default async function WallPage({ searchParams }: { searchParams: Promise<{ drop?: string }> }) {
  const { drop } = await searchParams;
  const dropId = drop ?? process.env.NEXT_PUBLIC_ACTIVE_DROP ?? '1';
  return <Wall dropId={dropId} />;
}
