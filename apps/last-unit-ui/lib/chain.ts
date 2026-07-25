import { createPublicClient, defineChain, http } from 'viem';

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);
export const CONTRACT = (process.env.NEXT_PUBLIC_CONTRACT ?? '0x') as `0x${string}`;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://testnet-rpc.monad.xyz';
export const EXPLORER = 'https://testnet.monadvision.com';
export const ACTIVE_DROP = BigInt(process.env.NEXT_PUBLIC_ACTIVE_DROP ?? '1');
export const CHECKPOINT = BigInt(process.env.NEXT_PUBLIC_CHECKPOINT ?? '1');
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

export const monad = defineChain({
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'MonadVision', url: EXPLORER } },
});

function createClients() {
  return {
    pub: createPublicClient({ chain: monad, transport: http() }),
  };
}

const g = globalThis as any;
export const clients: ReturnType<typeof createClients> =
  g.__db_clients ?? (g.__db_clients = createClients());
export const pub = clients.pub;
