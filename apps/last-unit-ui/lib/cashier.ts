import {
  encodeFunctionData,
  parseGwei,
  keccak256,
  BaseError,
  ContractFunctionRevertedError,
  decodeEventLog,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { pub, CHAIN_ID, CONTRACT } from './chain';
import { lastUnitAbi } from './abi';
import { readPk } from './pk';

export type RedeemResult =
  | { status: 'success'; tokenId: string; dropId: string; rank: number; txHash: string; chainMs: number }
  | { status: 'error'; errorName: string; errorArgs?: unknown[] };

// Same submission rules as the claim relayer: hardcoded gas, no eth_estimateGas,
// sendRawTransactionSync with fallback, local nonce, custom-error decoding.
function createCashier() {
  const account = privateKeyToAccount(readPk('CASHIER_PK'));
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

  async function decodeRevert(args: readonly [bigint, bigint, bigint, `0x${string}`]) {
    try {
      await pub.simulateContract({
        address: CONTRACT,
        abi: lastUnitAbi,
        functionName: 'redeem',
        args,
        account: account.address, // cashiers[msg.sender] check needs the real caller
      });
      return { errorName: 'UnknownRevert' as string, errorArgs: undefined as unknown[] | undefined };
    } catch (e) {
      if (e instanceof BaseError) {
        const revert = e.walk((err) => err instanceof ContractFunctionRevertedError);
        if (revert instanceof ContractFunctionRevertedError && revert.data) {
          return { errorName: revert.data.errorName, errorArgs: revert.data.args as unknown[] | undefined };
        }
      }
      return { errorName: 'UnknownRevert', errorArgs: undefined };
    }
  }

  async function redeem(
    tokenId: bigint,
    nonce: bigint,
    challengeBlock: bigint,
    ownerSig: `0x${string}`,
  ): Promise<RedeemResult> {
    await ensureInit();
    // One automatic retry: a stale local nonce (e.g. the same key used from
    // another environment) surfaces as an opaque RPC "internal error" on send.
    // After any unrecovered send failure we resync and try once more.
    let result = await attempt(tokenId, nonce, challengeBlock, ownerSig);
    if (result.status === 'error' && result.errorName === 'RetryAfterResync') {
      result = await attempt(tokenId, nonce, challengeBlock, ownerSig);
      if (result.status === 'error' && result.errorName === 'RetryAfterResync') {
        return { status: 'error', errorName: 'SubmitFailed' };
      }
    }
    return result;
  }

  async function attempt(
    tokenId: bigint,
    nonce: bigint,
    challengeBlock: bigint,
    ownerSig: `0x${string}`,
  ): Promise<RedeemResult> {
    const txNonce = state.nonce++;
    const args = [tokenId, nonce, challengeBlock, ownerSig] as const;
    let sentTxHash: `0x${string}` | null = null;

    try {
      const raw = await account.signTransaction({
        to: CONTRACT,
        data: encodeFunctionData({ abi: lastUnitAbi, functionName: 'redeem', args }),
        chainId: CHAIN_ID,
        nonce: txNonce,
        gas: 250_000n,
        maxFeePerGas: parseGwei('150'),
        maxPriorityFeePerGas: parseGwei('1'),
        type: 'eip1559',
      });
      sentTxHash = keccak256(raw);

      const t0 = Date.now();
      let receipt: any;
      try {
        receipt = await pub.request({ method: 'eth_sendRawTransactionSync' as any, params: [raw] as any });
      } catch (e: any) {
        const msg = String(e?.shortMessage ?? e?.message ?? '');
        if (/method|not supported|not found/i.test(msg)) {
          const hash = await pub.request({ method: 'eth_sendRawTransaction', params: [raw] });
          receipt = await pub.waitForTransactionReceipt({ hash: hash as `0x${string}`, pollingInterval: 100 });
        } else {
          throw e;
        }
      }
      const chainMs = Date.now() - t0;

      const ok = receipt.status === '0x1' || receipt.status === 'success';
      if (!ok) {
        const { errorName, errorArgs } = await decodeRevert(args);
        return { status: 'error', errorName, errorArgs };
      }

      let dropId = String(tokenId / 1_000_000n);
      let rank = Number(tokenId % 1_000_000n);
      for (const log of receipt.logs ?? []) {
        if (String(log.address).toLowerCase() !== CONTRACT.toLowerCase()) continue;
        try {
          const ev = decodeEventLog({ abi: lastUnitAbi, data: log.data, topics: log.topics });
          if (ev.eventName === 'Redeemed') dropId = String((ev.args as any).dropId);
        } catch {}
      }
      return { status: 'success', tokenId: String(tokenId), dropId, rank, txHash: receipt.transactionHash, chainMs };
    } catch (e: any) {
      const msg = String(e?.shortMessage ?? e?.message ?? '');
      // The send can fail on the RESPONSE path after the tx landed. Before
      // declaring failure (a post-hoc simulation would see the burned token and
      // misreport a successful redemption as TokenGone), check our own tx hash.
      if (sentTxHash) {
        try {
          const r = await pub.waitForTransactionReceipt({
            hash: sentTxHash,
            pollingInterval: 200,
            timeout: 3_000,
          });
          if (r.status === 'success') {
            return {
              status: 'success',
              tokenId: String(tokenId),
              dropId: String(tokenId / 1_000_000n),
              rank: Number(tokenId % 1_000_000n),
              txHash: sentTxHash,
              chainMs: 0,
            };
          }
        } catch {}
      }
      // tx did not land: resync unconditionally — stale nonces masquerade as
      // opaque internal errors, not always as "nonce too low"
      state.nonce = await pub.getTransactionCount({ address: account.address }).catch(() => state.nonce);

      const { errorName, errorArgs } = await decodeRevert(args);
      if (errorName === 'UnknownRevert') {
        // args are valid on-chain, so the failure was transport/nonce — retryable
        console.log(`[cashier] send failed (${msg || 'unknown'}), nonce resynced to ${state.nonce}`);
        return { status: 'error', errorName: 'RetryAfterResync' };
      }
      return { status: 'error', errorName, errorArgs };
    }
  }

  return { redeem, cashierAddress: account.address };
}

const g = globalThis as any;
export const cashier: ReturnType<typeof createCashier> =
  g.__db_cashier ?? (g.__db_cashier = createCashier());
