// npx tsx --env-file=.env.local scripts/smoke.mts [dropId]
// Simulates a phone: GET /api/challenge, sign as ephemeral player, POST /api/claim.
import { encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000';
const dropId = process.argv[2] ?? '1';
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT as `0x${string}`;
const CHAIN_ID = BigInt(process.env.NEXT_PUBLIC_CHAIN_ID!);

const t0 = Date.now();
const ch = await fetch(`${BASE}/api/challenge?dropId=${dropId}`).then((r) => r.json());
console.log('challenge:', ch.id, 'block', ch.challengeBlock);

const challengeHash = keccak256(
  encodeAbiParameters(
    parseAbiParameters('uint256, address, uint256, uint256, uint256'),
    [CHAIN_ID, CONTRACT, BigInt(ch.cpId), BigInt(ch.nonce), BigInt(ch.challengeBlock)],
  ),
);
const player = privateKeyToAccount(generatePrivateKey());
const playerHashValue = keccak256(
  encodeAbiParameters(parseAbiParameters('bytes32, uint256'), [challengeHash, BigInt(ch.dropId)]),
);
const playerSig = await player.signMessage({ message: { raw: playerHashValue } });

const res = await fetch(`${BASE}/api/claim`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: ch.id, playerSig, clientElapsedMs: Date.now() - t0 }),
});
console.log('claim status', res.status, ':', JSON.stringify(await res.json(), null, 2));
