import {
  encodeFunctionData,
  parseGwei,
  BaseError,
  ContractFunctionRevertedError,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { pub, CHAIN_ID, CONTRACT } from './chain';
import { lastUnitAbi } from './abi';
import { watcher } from './watcher';
import type { Challenge } from './beacon';

export type ClaimResult =
  | {
      status: 'success';
      rank: number;
      supply: number;
      tokenId: string;
      player: string;
      txHash: string;
      blockNumber: number;
      challengeBlock: number;
      claimBlock: number;
      chainMs: number;
      endToEndMs: number;
    }
  | { status: 'error'; errorName: string; errorArgs?: unknown[]; chainMs?: number };

// Each claim goes out from a different account, drawn round-robin. Independent
// accounts have independent nonces, so relative ordering of concurrent claims is
// genuinely decided by the leader — a single sender's sequential nonces would
// pre-order them at the protocol level and make the race fake.
type Lane = { account: PrivateKeyAccount; nonce: number };

function laneKeys(): `0x${string}`[] {
  const multi = process.env.RELAYER_PKS;
  if (multi && multi.trim()) {
    return multi.split(',').map((k) => k.trim() as `0x${string}`).filter(Boolean);
  }
  return [process.env.RELAYER_PK as `0x${string}`];
}

function createRelayer() {
  const lanes: Lane[] = laneKeys().map((pk) => ({
    account: privateKeyToAccount(pk),
    nonce: -1,
  }));
  const state = { rr: 0, initPromise: null as Promise<void> | null, initialized: false };

  async function ensureInit() {
    if (state.initialized) return;
    state.initPromise ??= Promise.all(
      lanes.map(async (lane) => {
        lane.nonce = await pub.getTransactionCount({ address: lane.account.address });
      }),
    )
      .then(() => {
        state.initialized = true;
        console.log(`[relayer] pool ready: ${lanes.length} lane(s)`);
      })
      .finally(() => {
        state.initPromise = null;
      });
    await state.initPromise;
  }

  async function resyncLane(lane: Lane) {
    lane.nonce = await pub.getTransactionCount({ address: lane.account.address });
  }

  // Fully synchronous: no await between picking the lane and taking its nonce,
  // or concurrent claims would collide on one lane's nonce.
  function takeLane(): { lane: Lane; txNonce: number } {
    const lane = lanes[state.rr++ % lanes.length];
    return { lane, txNonce: lane.nonce++ };
  }

  async function decodeRevert(challenge: Challenge, playerSig: `0x${string}`) {
    try {
      await pub.simulateContract({
        address: CONTRACT,
        abi: lastUnitAbi,
        functionName: 'claim',
        args: [challenge.dropId, challenge.nonce, challenge.challengeBlock, challenge.beaconSig, playerSig],
      });
      return { errorName: 'UnknownRevert' as string, errorArgs: undefined as unknown[] | undefined };
    } catch (e) {
      if (e instanceof BaseError) {
        const revert = e.walk((err) => err instanceof ContractFunctionRevertedError);
        if (revert instanceof ContractFunctionRevertedError && revert.data) {
          return {
            errorName: revert.data.errorName,
            errorArgs: revert.data.args as unknown[] | undefined,
          };
        }
      }
      return { errorName: 'UnknownRevert', errorArgs: undefined };
    }
  }

  async function submit(
    challenge: Challenge,
    playerSig: `0x${string}`,
    clientElapsedMs: number,
  ): Promise<ClaimResult> {
    await ensureInit();
    const { lane, txNonce } = takeLane();

    const data = encodeFunctionData({
      abi: lastUnitAbi,
      functionName: 'claim',
      args: [challenge.dropId, challenge.nonce, challenge.challengeBlock, challenge.beaconSig, playerSig],
    });

    try {
      const raw = await lane.account.signTransaction({
        to: CONTRACT,
        data,
        chainId: CHAIN_ID,
        nonce: txNonce,
        gas: 250_000n,
        maxFeePerGas: parseGwei('150'),
        maxPriorityFeePerGas: parseGwei('1'),
        type: 'eip1559',
      });

      console.log(`[relayer] claim drop=${challenge.dropId} lane=${lane.account.address} nonce=${txNonce}`);

      const t0 = Date.now();
      let receipt: any;
      try {
        receipt = await pub.request({
          method: 'eth_sendRawTransactionSync' as any,
          params: [raw] as any,
        });
      } catch (e: any) {
        const msg = String(e?.shortMessage ?? e?.message ?? '');
        if (/method|not supported|not found/i.test(msg)) {
          const hash = await pub.request({ method: 'eth_sendRawTransaction', params: [raw] });
          receipt = await pub.waitForTransactionReceipt({
            hash: hash as `0x${string}`,
            pollingInterval: 100,
          });
        } else {
          throw e;
        }
      }
      const chainMs = Date.now() - t0;

      const status = receipt.status === '0x1' || receipt.status === 'success' ? 'success' : 'reverted';
      const txHash = receipt.transactionHash as string;
      const blockNumber = Number(BigInt(receipt.blockNumber));

      if (status !== 'success') {
        const { errorName, errorArgs } = await decodeRevert(challenge, playerSig);
        return { status: 'error', errorName, errorArgs, chainMs };
      }

      // pull rank/tokenId/supply/player from the Claimed log
      let rank = 0;
      let supply = 0;
      let tokenId = '';
      let player = '';
      for (const log of receipt.logs ?? []) {
        if (String(log.address).toLowerCase() !== CONTRACT.toLowerCase()) continue;
        try {
          const { decodeEventLog } = await import('viem');
          const ev = decodeEventLog({ abi: lastUnitAbi, data: log.data, topics: log.topics });
          if (ev.eventName === 'Claimed') {
            rank = Number((ev.args as any).rank);
            supply = Number((ev.args as any).supply);
            tokenId = String((ev.args as any).tokenId);
            player = String((ev.args as any).player);
          }
        } catch {}
      }

      const endToEndMs = Math.round(clientElapsedMs + chainMs);
      watcher.recordTimings(txHash, chainMs, endToEndMs);
      return {
        status: 'success',
        rank,
        supply,
        tokenId,
        player,
        txHash,
        blockNumber,
        challengeBlock: Number(challenge.challengeBlock),
        claimBlock: blockNumber,
        chainMs,
        endToEndMs,
      };
    } catch (e: any) {
      const msg = String(e?.shortMessage ?? e?.message ?? '');
      if (/nonce/i.test(msg)) {
        // resync only the lane that failed; the others are untouched
        await resyncLane(lane).catch(() => {});
      }
      const { errorName, errorArgs } = await decodeRevert(challenge, playerSig);
      return { status: 'error', errorName: errorName === 'UnknownRevert' ? msg || 'SubmitFailed' : errorName, errorArgs };
    }
  }

  return { submit, laneAddresses: lanes.map((l) => l.account.address) };
}

const g = globalThis as any;
export const relayer: ReturnType<typeof createRelayer> =
  g.__db_relayer ?? (g.__db_relayer = createRelayer());
