// npx tsx --env-file=.env.local scripts/parity.ts
// Verifies TS challengeHash/playerHash byte-parity with the deployed contract (§5).
import { createPublicClient, http, defineChain, encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';
import { flashDropAbi } from '../lib/abi';

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT as `0x${string}`;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID);

const monad = defineChain({
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL!] } },
});

const pub = createPublicClient({ chain: monad, transport: http() });

const cpId = 1n;
const nonce = 170141183460469231731687303715884105727n; // arbitrary 128-bit
const challengeBlock = 42n;
const dropId = 1n;

const tsChallenge = keccak256(
  encodeAbiParameters(
    parseAbiParameters('uint256, address, uint256, uint256, uint256'),
    [BigInt(CHAIN_ID), CONTRACT, cpId, nonce, challengeBlock],
  ),
);
const tsPlayer = keccak256(
  encodeAbiParameters(parseAbiParameters('bytes32, uint256'), [tsChallenge, dropId]),
);

const onchainChallenge = await pub.readContract({
  address: CONTRACT, abi: flashDropAbi, functionName: 'challengeHash',
  args: [cpId, nonce, challengeBlock],
});
const onchainPlayer = await pub.readContract({
  address: CONTRACT, abi: flashDropAbi, functionName: 'playerHash',
  args: [tsChallenge, dropId],
});

console.log('challengeHash TS      ', tsChallenge);
console.log('challengeHash on-chain', onchainChallenge);
console.log('playerHash    TS      ', tsPlayer);
console.log('playerHash    on-chain', onchainPlayer);

if (tsChallenge !== onchainChallenge || tsPlayer !== onchainPlayer) {
  console.error('PARITY FAIL');
  process.exit(1);
}
console.log('PARITY OK');
