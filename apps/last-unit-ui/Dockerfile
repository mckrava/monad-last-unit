# Next.js standalone image for last-unit-ui.
# Build context is the REPO ROOT (the CI workflow builds with `context: .`):
#   docker build -f apps/last-unit-ui/Dockerfile \
#     --build-arg NEXT_PUBLIC_CONTRACT=0x... \
#     --build-arg NEXT_PUBLIC_BASE_URL=https://last-unit.burnedcore.com .
#
# NEXT_PUBLIC_* are BUILD-TIME: Next.js inlines them into the client bundle
# during `next build`. Changing the contract address or the public URL means
# rebuilding the image — editing stack.yml alone will NOT change them.

FROM node:24-alpine AS deps
WORKDIR /app
COPY apps/last-unit-ui/package.json apps/last-unit-ui/package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/last-unit-ui/ ./

ARG NEXT_PUBLIC_CHAIN_ID=10143
ARG NEXT_PUBLIC_RPC_URL=https://testnet-rpc.monad.xyz
ARG NEXT_PUBLIC_CONTRACT
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_ACTIVE_DROP=1
ARG NEXT_PUBLIC_CHECKPOINT=1
ENV NEXT_PUBLIC_CHAIN_ID=$NEXT_PUBLIC_CHAIN_ID \
    NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL \
    NEXT_PUBLIC_CONTRACT=$NEXT_PUBLIC_CONTRACT \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_PUBLIC_ACTIVE_DROP=$NEXT_PUBLIC_ACTIVE_DROP \
    NEXT_PUBLIC_CHECKPOINT=$NEXT_PUBLIC_CHECKPOINT \
    NEXT_TELEMETRY_DISABLED=1

# Dummy keys so module-init key parsing (lib/beacon.ts, lib/relayer.ts,
# lib/cashier.ts) survives `next build`. They are never real: the runtime
# values come from Swarm secrets.
ENV BEACON_PK=0x0000000000000000000000000000000000000000000000000000000000000001 \
    RELAYER_PK=0x0000000000000000000000000000000000000000000000000000000000000002 \
    CASHIER_PK=0x0000000000000000000000000000000000000000000000000000000000000003

RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
