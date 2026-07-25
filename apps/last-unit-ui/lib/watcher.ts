import { pub, CONTRACT } from './chain';
import { flashDropAbi } from './abi';

export type WallClaim = {
  dropId: string;
  player: string;
  tokenId: string;
  rank: number;
  supply: number;
  challengeBlock: number;
  claimBlock: number;
  txHash: string;
  chainMs?: number;
  endToEndMs?: number;
};

export type DropStatusMsg = {
  dropId: string;
  supply: number;
  claimed: number;
  freshness: number;
  active: boolean;
  name: string;
};

type Sub = (event: string, data: unknown) => void;

// txHash -> timings, filled by the relayer, read when the Claimed log arrives
function createTimings() {
  return new Map<string, { chainMs: number; endToEndMs?: number }>();
}

function createWatcher() {
  const state = {
    latestBlock: 0,
    claims: [] as WallClaim[],
    statuses: {} as Record<string, DropStatusMsg>,
    subs: new Set<Sub>(),
  };

  const timings = createTimings();

  function broadcast(event: string, data: unknown) {
    for (const sub of state.subs) {
      try {
        sub(event, data);
      } catch {}
    }
  }

  pub.watchBlockNumber({
    pollingInterval: 250,
    onBlockNumber: (bn) => {
      const n = Number(bn);
      if (n !== state.latestBlock) {
        state.latestBlock = n;
        broadcast('block', { number: n });
      }
    },
    onError: () => {},
  });

  pub.watchContractEvent({
    address: CONTRACT,
    abi: flashDropAbi,
    eventName: 'Claimed',
    pollingInterval: 250,
    onLogs: (logs) => {
      for (const log of logs) {
        const a = log.args as any;
        const txHash = log.transactionHash ?? '';
        if (state.claims.some((c) => c.txHash === txHash && c.tokenId === String(a.tokenId))) continue;
        const t = timings.get(txHash);
        const claim: WallClaim = {
          dropId: String(a.dropId),
          player: a.player,
          tokenId: String(a.tokenId),
          rank: Number(a.rank),
          supply: Number(a.supply),
          challengeBlock: Number(a.challengeBlock),
          claimBlock: Number(a.claimBlock),
          txHash,
          chainMs: t?.chainMs,
          endToEndMs: t?.endToEndMs,
        };
        state.claims.push(claim);
        if (state.claims.length > 200) state.claims.splice(0, state.claims.length - 200);
        broadcast('claim', claim);
      }
    },
    onError: () => {},
  });

  async function pollStatus(dropId: bigint) {
    try {
      const [supply, claimed, freshness, active, name] = await pub.readContract({
        address: CONTRACT,
        abi: flashDropAbi,
        functionName: 'dropStatus',
        args: [dropId],
      });
      const msg: DropStatusMsg = {
        dropId: String(dropId),
        supply,
        claimed,
        freshness,
        active,
        name,
      };
      const prev = state.statuses[msg.dropId];
      if (!prev || JSON.stringify(prev) !== JSON.stringify(msg)) {
        state.statuses[msg.dropId] = msg;
        broadcast('status', msg);
      }
    } catch {}
  }

  setInterval(() => {
    pollStatus(1n);
    pollStatus(2n);
  }, 1000);

  function subscribe(fn: Sub) {
    state.subs.add(fn);
    return () => state.subs.delete(fn);
  }

  function recordTimings(txHash: string, chainMs: number, endToEndMs?: number) {
    timings.set(txHash, { chainMs, endToEndMs });
    // if the log already arrived before timings were recorded, patch and re-broadcast
    const existing = state.claims.find((c) => c.txHash === txHash);
    if (existing) {
      existing.chainMs = chainMs;
      existing.endToEndMs = endToEndMs;
      broadcast('claim', existing);
    }
  }

  return { state, subscribe, broadcast, recordTimings };
}

const g = globalThis as any;
export const watcher: ReturnType<typeof createWatcher> =
  g.__db_watcher ?? (g.__db_watcher = createWatcher());
