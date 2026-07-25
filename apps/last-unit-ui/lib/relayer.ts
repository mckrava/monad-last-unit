import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbiParameters,
  parseGwei,
  BaseError,
  ContractFunctionRevertedError,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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

function createRelayer() {
  const account = privateKeyToAccount(process.env.RELAYER_PK as `0x${string}`);
  const state = { nonce: -1, initPromise: null as Promise<void> | null };

  async function ensureInit() {
    if (state.nonce >= 0) return;
    state.initPromise ??= pub
      .getTransactionCount({ address: account.address })
      .then((n) => {
        state.nonce = n;
      })
      .finally(() => {
        state.initPromise = null;
      });
    await state.initPromise;
  }

  async function resyncNonce() {
    state.nonce = await pub.getTransactionCount({ address: account.address });
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
    // allocate synchronously before any await so parallel claims get distinct nonces
    const txNonce = state.nonce++;

    const data = encodeFunctionData({
      abi: lastUnitAbi,
      functionName: 'claim',
      args: [challenge.dropId, challenge.nonce, challenge.challengeBlock, challenge.beaconSig, playerSig],
    });

    try {
      const raw = await account.signTransaction({
        to: CONTRACT,
        data,
        chainId: CHAIN_ID,
        nonce: txNonce,
        gas: 250_000n,
        maxFeePerGas: parseGwei('150'),
        maxPriorityFeePerGas: parseGwei('1'),
        type: 'eip1559',
      });

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
        // Claimed topic0 check is overkill for one contract; match by address
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
        await resyncNonce().catch(() => {});
      }
      // try to decode a custom error from a rejected-at-send revert
      const { errorName, errorArgs } = await decodeRevert(challenge, playerSig);
      return { status: 'error', errorName: errorName === 'UnknownRevert' ? msg || 'SubmitFailed' : errorName, errorArgs };
    }
  }

  return { submit, relayerAddress: account.address };
}

const g = globalThis as any;
export const relayer: ReturnType<typeof createRelayer> =
  g.__db_relayer ?? (g.__db_relayer = createRelayer());
