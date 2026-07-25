'use client';

import { useEffect, useRef, useState } from 'react';
import { toFailureCode, type ClaimResult, type Hex } from '@/lib/types';
import ClaimSubmitting from '@/components/claim/ClaimSubmitting';
import ClaimSuccess from '@/components/claim/ClaimSuccess';
import ClaimFailure from '@/components/claim/ClaimFailure';

/**
 * Claim page — /c/[id]. Mobile only. There is no button: it signs and submits on load
 * and the user spectates for 1–3 seconds. Everything here is a waiting-then-verdict screen.
 */
export default function Claim({
  id,
  dropId,
  challengeHash,
  challengeBlock,
  supply,
  claimed,
  expired,
}: {
  id: string;
  dropId?: string;
  challengeHash?: Hex;
  challengeBlock?: number;
  supply?: number;
  claimed?: number;
  expired?: boolean;
}) {
  const [result, setResult] = useState<ClaimResult>(
    expired ? { status: 'failed', code: 'StaleChallenge' } : { status: 'submitting' },
  );
  const fired = useRef(false);

  useEffect(() => {
    if (expired || !dropId || !challengeHash) return;
    if (fired.current) return; // survive React strict-mode double mount
    fired.current = true;

    (async () => {
      try {
        // ephemeral key: generated in memory, never persisted, one per page load
        const [{ generatePrivateKey, privateKeyToAccount }, { encodeAbiParameters, keccak256, parseAbiParameters }] =
          await Promise.all([import('viem/accounts'), import('viem')]);
        const account = privateKeyToAccount(generatePrivateKey());
        const playerHashValue = keccak256(
          encodeAbiParameters(parseAbiParameters('bytes32, uint256'), [challengeHash, BigInt(dropId)]),
        );
        const playerSig = await account.signMessage({ message: { raw: playerHashValue } });
        // page load + keygen + sign: the human half of the latency
        const clientElapsedMs = Math.round(performance.now());

        const res = await fetch('/api/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, playerSig, clientElapsedMs }),
        });
        const json = await res.json();

        if (json.status === 'success') {
          setResult({
            status: 'success',
            claim: {
              rank: json.rank,
              supply: json.supply,
              player: json.player,
              tokenId: json.tokenId,
              chainMs: json.chainMs,
              endToEndMs: json.endToEndMs,
              challengeBlock: json.challengeBlock,
              claimBlock: json.claimBlock,
            },
            txHash: json.txHash,
          });
        } else {
          const args: string[] = json.errorArgs ?? [];
          setResult({
            status: 'failed',
            code: json.errorName === 'UnknownChallenge' ? 'StaleChallenge' : toFailureCode(json.errorName),
            detail: {
              age: args[0] != null ? Number(args[0]) : undefined,
              max: args[1] != null ? Number(args[1]) : undefined,
              challengeBlock,
              supply,
            },
            txHash: json.txHash,
          });
        }
      } catch {
        setResult({ status: 'failed', code: 'Reverted' });
      }
    })();
  }, [id, dropId, challengeHash, challengeBlock, supply, expired]);

  if (result.status === 'submitting')
    return <ClaimSubmitting remaining={supply != null && claimed != null ? supply - claimed : null} supply={supply} />;
  if (result.status === 'success') return <ClaimSuccess claim={result.claim} txHash={result.txHash} />;
  return <ClaimFailure code={result.code} detail={result.detail} txHash={result.txHash} />;
}
