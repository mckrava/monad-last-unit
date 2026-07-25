import { encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { CHAIN_ID, CONTRACT, BASE_URL } from './chain';
import { watcher } from './watcher';

export type Challenge = {
  id: string;
  cpId: bigint;
  dropId: bigint;
  nonce: bigint;
  challengeBlock: bigint;
  challengeHash: `0x${string}`;
  beaconSig: `0x${string}`;
  url: string;
  issuedAt: number;
};

const B62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function shortId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let out = '';
  for (const b of bytes) out += B62[b % 62];
  return out;
}

function createBeacon() {
  const account = privateKeyToAccount(process.env.BEACON_PK as `0x${string}`);
  const store = new Map<string, Challenge>();

  async function issue(cpId: bigint, dropId: bigint): Promise<Challenge> {
    // cached block from the watcher, not a fresh RPC call —
    // except before the first poll lands, where 0 would make every claim stale
    let latest = watcher.state.latestBlock;
    if (!latest) {
      const { pub } = await import('./chain');
      latest = Number(await pub.getBlockNumber());
      watcher.state.latestBlock = latest;
    }
    const challengeBlock = BigInt(latest);
    const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
    const nonce = BigInt(
      '0x' + Array.from(nonceBytes, (b) => b.toString(16).padStart(2, '0')).join(''),
    );
    const challengeHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters('uint256, address, uint256, uint256, uint256'),
        [BigInt(CHAIN_ID), CONTRACT, cpId, nonce, challengeBlock],
      ),
    );
    const beaconSig = await account.signMessage({ message: { raw: challengeHash } });
    const id = shortId();
    const challenge: Challenge = {
      id,
      cpId,
      dropId,
      nonce,
      challengeBlock,
      challengeHash,
      beaconSig,
      url: `${BASE_URL}/c/${id}`,
      issuedAt: Date.now(),
    };
    store.set(id, challenge);
    // cap at last 120 entries
    if (store.size > 120) {
      const oldest = store.keys().next().value;
      if (oldest) store.delete(oldest);
    }
    return challenge;
  }

  function get(id: string): Challenge | undefined {
    return store.get(id);
  }

  return { issue, get, beaconAddress: account.address };
}

const g = globalThis as any;
export const beacon: ReturnType<typeof createBeacon> =
  g.__db_beacon ?? (g.__db_beacon = createBeacon());
