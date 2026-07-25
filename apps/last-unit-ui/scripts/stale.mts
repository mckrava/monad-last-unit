// npx tsx --env-file=.env.local scripts/stale.mts
// Grabs a challenge, waits past the freshness window, then claims → expects StaleChallenge copy.
import { encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const BASE = 'http://localhost:3000';
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT as `0x${string}`;
const CHAIN_ID = BigInt(process.env.NEXT_PUBLIC_CHAIN_ID!);

const ch = await fetch(`${BASE}/api/challenge?dropId=1`).then((r) => r.json());
console.log('challenge at block', ch.challengeBlock, '— waiting 20s (freshness = 50 blocks ≈ 15s)');
await new Promise((r) => setTimeout(r, 20000));

const challengeHash = keccak256(
  encodeAbiParameters(
    parseAbiParameters('uint256, address, uint256, uint256, uint256'),
    [CHAIN_ID, CONTRACT, BigInt(ch.cpId), BigInt(ch.nonce), BigInt(ch.challengeBlock)],
  ),
);
const player = privateKeyToAccount(generatePrivateKey());
const playerSig = await player.signMessage({
  message: { raw: keccak256(encodeAbiParameters(parseAbiParameters('bytes32, uint256'), [challengeHash, BigInt(ch.dropId)])) },
});
const res = await fetch(`${BASE}/api/claim`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: ch.id, playerSig, clientElapsedMs: 20000 }),
});
console.log(res.status, JSON.stringify(await res.json()));
