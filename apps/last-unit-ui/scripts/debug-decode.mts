// npx tsx --env-file=.env.local scripts/debug-decode.mts
import { createPublicClient, http, defineChain, encodeAbiParameters, keccak256, parseAbiParameters, BaseError, ContractFunctionRevertedError } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { flashDropAbi } from '../lib/abi';

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT as `0x${string}`;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
const monad = defineChain({ id: CHAIN_ID, name: 'Monad', nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL!] } } });
const pub = createPublicClient({ chain: monad, transport: http() });

const beacon = privateKeyToAccount(process.env.BEACON_PK as `0x${string}`);
const dropId = 2n, cpId = 1n, nonce = 12345n;
const challengeBlock = await pub.getBlockNumber();
const challengeHash = keccak256(encodeAbiParameters(parseAbiParameters('uint256, address, uint256, uint256, uint256'), [BigInt(CHAIN_ID), CONTRACT, cpId, nonce, challengeBlock]));
const beaconSig = await beacon.signMessage({ message: { raw: challengeHash } });
const player = privateKeyToAccount(generatePrivateKey());
const playerSig = await player.signMessage({ message: { raw: keccak256(encodeAbiParameters(parseAbiParameters('bytes32, uint256'), [challengeHash, dropId])) } });

try {
  await pub.simulateContract({ address: CONTRACT, abi: flashDropAbi, functionName: 'claim', args: [dropId, nonce, challengeBlock, beaconSig, playerSig] });
  console.log('no revert?!');
} catch (e) {
  console.log('error class:', (e as any)?.constructor?.name);
  if (e instanceof BaseError) {
    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError);
    console.log('walked:', (revert as any)?.constructor?.name, (revert as any)?.data);
    console.log('full walk chain:');
    let cur: any = e;
    while (cur) { console.log(' -', cur.constructor?.name, cur.shortMessage ?? ''); cur = cur.cause; }
  }
}
