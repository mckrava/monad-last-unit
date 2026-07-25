// npx tsx --env-file=.env.local scripts/redeem-e2e.mts [dropId]
// Full pickup loop through the HTTP API, exactly as phone + cashier terminal do it:
// claim -> receipt/open -> redeemHash parity check -> receipt/refresh -> redeem ->
// second redeem must fail TokenGone.
import { createPublicClient, http, defineChain, encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { lastUnitAbi } from '../lib/abi';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000';
const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT as `0x${string}`;
const CHAIN_ID = BigInt(process.env.NEXT_PUBLIC_CHAIN_ID!);
const dropId = process.argv[2] ?? '1';

const monad = defineChain({ id: Number(CHAIN_ID), name: 'Monad', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL!] } } });
const pub = createPublicClient({ chain: monad, transport: http() });

// --- claim (device key persists for the receipt step) ---
const player = privateKeyToAccount(generatePrivateKey());
const ch = await fetch(`${BASE}/api/challenge?dropId=${dropId}`).then((r) => r.json());
const challengeHash = keccak256(encodeAbiParameters(parseAbiParameters('uint256, address, uint256, uint256, uint256'), [CHAIN_ID, CONTRACT, BigInt(ch.cpId), BigInt(ch.nonce), BigInt(ch.challengeBlock)]));
const playerSig = await player.signMessage({ message: { raw: keccak256(encodeAbiParameters(parseAbiParameters('bytes32, uint256'), [challengeHash, BigInt(ch.dropId)])) } });
const claim = await fetch(`${BASE}/api/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ch.id, playerSig, clientElapsedMs: 100 }) }).then((r) => r.json());
if (claim.status !== 'success') throw new Error('claim failed: ' + JSON.stringify(claim));
console.log(`claimed rank ${claim.rank}, token ${claim.tokenId}`);

// --- open receipt ---
const open = await fetch(`${BASE}/api/receipt/open`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokenId: claim.tokenId, player: player.address }) }).then((r) => r.json());
console.log(`receipt code ${open.code} for "${open.dropName}" #${open.rank}/${open.supply}`);

// --- redeemHash parity: TS vs on-chain (domain separator uint8(1)) ---
const block = await pub.getBlockNumber();
const nonce = 123456789n;
const tsHash = keccak256(encodeAbiParameters(parseAbiParameters('uint256, address, uint8, uint256, uint256, uint256'), [CHAIN_ID, CONTRACT, 1, BigInt(claim.tokenId), nonce, block]));
const onchainHash = await pub.readContract({ address: CONTRACT, abi: lastUnitAbi, functionName: 'redeemHash', args: [BigInt(claim.tokenId), nonce, block] });
if (tsHash !== onchainHash) throw new Error(`redeemHash PARITY FAIL: ${tsHash} != ${onchainHash}`);
console.log('redeemHash parity OK');

// --- refresh bundle (what the receipt page does every second) ---
const ownerSig = await player.signMessage({ message: { raw: tsHash } });
const refresh = await fetch(`${BASE}/api/receipt/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: open.code, nonce: String(nonce), challengeBlock: Number(block), ownerSig }) });
console.log('refresh:', refresh.status);

// --- redeem (what the cashier terminal does) ---
const redeem = await fetch(`${BASE}/api/redeem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: open.code }) }).then((r) => r.json());
console.log('redeem:', JSON.stringify(redeem));
if (redeem.status !== 'success') throw new Error('redeem failed');

// --- second redeem must fail: bundle is stale-by-burn -> TokenGone from chain ---
const ownerSig2 = await player.signMessage({ message: { raw: tsHash } });
await fetch(`${BASE}/api/receipt/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: open.code, nonce: String(nonce), challengeBlock: Number(block), ownerSig: ownerSig2 }) });
const again = await fetch(`${BASE}/api/redeem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: open.code }) }).then((r) => r.json());
console.log('second redeem (expect TokenGone):', again.errorName);

// --- unknown code ---
const unknown = await fetch(`${BASE}/api/redeem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: '000000' }) });
console.log('unknown code status (expect 404):', unknown.status);
