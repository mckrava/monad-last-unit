import {
  encodeFunctionData,
  parseGwei,
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
    const txNonce = state.nonce++;
    const args = [tokenId, nonce, challengeBlock, ownerSig] as const;

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
      if (/nonce/i.test(msg)) {
        state.nonce = await pub.getTransactionCount({ address: account.address }).catch(() => state.nonce);
      }
      const { errorName, errorArgs } = await decodeRevert(args);
      return {
        status: 'error',
        errorName: errorName === 'UnknownRevert' ? msg || 'SubmitFailed' : errorName,
        errorArgs,
      };
    }
  }

  return { redeem, cashierAddress: account.address };
}

const g = globalThis as any;
export const cashier: ReturnType<typeof createCashier> =
  g.__db_cashier ?? (g.__db_cashier = createCashier());
