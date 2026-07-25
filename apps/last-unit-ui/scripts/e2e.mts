// npx tsx --env-file=.env.local scripts/e2e.ts [dropId]
// Full claim without a browser: beacon signs challenge, ephemeral player signs,
// relayer submits via eth_sendRawTransactionSync, Claimed event decoded (§14 step 4).
import {
  createPublicClient, http, defineChain, encodeAbiParameters, keccak256,
  parseAbiParameters, encodeFunctionData, parseGwei, decodeEventLog,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { flashDropAbi } from '../lib/abi';

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT as `0x${string}`;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
const dropId = BigInt(process.argv[2] ?? '1');
const cpId = 1n;

const monad = defineChain({
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL!] } },
});
const pub = createPublicClient({ chain: monad, transport: http() });

const beacon = privateKeyToAccount(process.env.BEACON_PK as `0x${string}`);
const relayer = privateKeyToAccount(process.env.RELAYER_PK as `0x${string}`);

// beacon side
const challengeBlock = await pub.getBlockNumber();
const nonce = BigInt('0x' + crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), ''));
const challengeHash = keccak256(
  encodeAbiParameters(
    parseAbiParameters('uint256, address, uint256, uint256, uint256'),
    [BigInt(CHAIN_ID), CONTRACT, cpId, nonce, challengeBlock],
  ),
);
const beaconSig = await beacon.signMessage({ message: { raw: challengeHash } });

// player side (ephemeral)
const player = privateKeyToAccount(generatePrivateKey());
const playerHashValue = keccak256(
  encodeAbiParameters(parseAbiParameters('bytes32, uint256'), [challengeHash, dropId]),
);
const playerSig = await player.signMessage({ message: { raw: playerHashValue } });

// relayer side
const txNonce = await pub.getTransactionCount({ address: relayer.address });
const data = encodeFunctionData({
  abi: flashDropAbi, functionName: 'claim',
  args: [dropId, nonce, challengeBlock, beaconSig, playerSig],
});
const raw = await relayer.signTransaction({
  to: CONTRACT, data, chainId: CHAIN_ID, nonce: txNonce,
  gas: 250_000n, maxFeePerGas: parseGwei('150'), maxPriorityFeePerGas: parseGwei('1'),
  type: 'eip1559',
});

const t0 = Date.now();
let receipt: any;
try {
  receipt = await pub.request({ method: 'eth_sendRawTransactionSync' as any, params: [raw] as any });
} catch (e: any) {
  console.log('sync send failed, falling back:', e.shortMessage ?? e.message);
  const hash = await pub.request({ method: 'eth_sendRawTransaction', params: [raw] });
  receipt = await pub.waitForTransactionReceipt({ hash: hash as `0x${string}`, pollingInterval: 100 });
}
const chainMs = Date.now() - t0;

console.log('status:', receipt.status, 'block:', BigInt(receipt.blockNumber).toString(), 'chainMs:', chainMs);
for (const log of receipt.logs ?? []) {
  try {
    const ev = decodeEventLog({ abi: flashDropAbi, data: log.data, topics: log.topics });
    if (ev.eventName === 'Claimed') {
      const a: any = ev.args;
      console.log(`Claimed: rank=${a.rank} tokenId=${a.tokenId} player=${a.player}`);
      console.log(`challenge age at inclusion: ${BigInt(a.claimBlock) - BigInt(a.challengeBlock)} blocks`);
    }
  } catch {}
}
