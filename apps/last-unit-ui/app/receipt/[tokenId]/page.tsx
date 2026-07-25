import Receipt from './Receipt';

export const dynamic = 'force-dynamic';

export default async function ReceiptPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params;
  return <Receipt tokenId={tokenId} />;
}
