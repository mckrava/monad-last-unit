# doorbuster / last-unit

Verified-presence flash drop on Monad testnet. A limited drop can only be claimed by
scanning a short-lived, beacon-signed QR from a display in the venue. The chain enforces
challenge freshness; Monad's transaction ordering decides who got the last units. Remote
claimers (screenshot relays) are structurally slower and lose the race.

## Deployed (Monad testnet, chain 10143)

| | |
|---|---|
| FlashDrop contract | `0x6804ef6cFD0088c7A499A89641Cd59ca8be3e5d2` |
| Explorer | https://testnet.monadvision.com/address/0x6804ef6cFD0088c7A499A89641Cd59ca8be3e5d2 |
| Beacon signer | `0xd5b8d66002916CF0fddEacfd05e9f77D9aE8CBeF` (no funds needed, signs only) |
| Relayer | `0x33Ce8977c712358F389429A18d68F37485791Ee3` (pays all gas, funded 2 MON) |
| Drop 1 | "Doorbuster x50" — supply 50, freshness 50 blocks (~15s) |
| Drop 2 | "Last Units x2" — supply 2, the stage demo |

Keys live in `apps/last-unit-ui/.env.local` (gitignored). Owner key is `CONTRACT_OWNER_PK`
in the root `.env`.

## Layout

- `foundry/` — FlashDrop contract, 7 invariant tests, deploy script
- `apps/last-unit-ui/` — Next.js 16 app: beacon display, claim page, wall, relayer API

## Run the demo

```bash
cd apps/last-unit-ui
npx next dev -H 0.0.0.0        # phones must reach your LAN IP (NEXT_PUBLIC_BASE_URL)
```

- **Beacon (in-store display):** `http://<lan-ip>:3000/beacon/1?drop=2` — QR rotates 1/s
- **Wall (leaderboard):** `http://<lan-ip>:3000/wall?drop=2` — live ranks, block gaps, latencies
- **Claim:** scan the QR with a phone on the same Wi-Fi. Auto-submits on page load —
  ephemeral in-browser key, gas paid by the relayer, no wallet.

If your LAN IP changed, update `NEXT_PUBLIC_BASE_URL` in `apps/last-unit-ui/.env.local`.

## Scripts (apps/last-unit-ui)

```bash
npx tsx --env-file=.env.local scripts/parity.mts   # TS vs on-chain hash parity (§5 check)
npx tsx --env-file=.env.local scripts/e2e.mts 1    # full claim without a browser
npx tsx --env-file=.env.local scripts/smoke.mts 2  # claim through the HTTP API like a phone
npx tsx --env-file=.env.local scripts/stale.mts    # StaleChallenge error path (waits 20s)
```

## Contracts

```bash
cd foundry
forge test          # 7 invariants: rank/tokenId, freshness boundary, future challenge,
                    # bad beacon sig, double claim, sold out, independent drops
```

Admin ops go through `cast` (no admin UI), e.g. reset the stage demo by creating a new drop:

```bash
source ../.env
cast send 0x6804ef6cFD0088c7A499A89641Cd59ca8be3e5d2 \
  "createDrop(uint256,uint256,uint32,uint32,string)" 3 1 2 50 "Encore x2" \
  --rpc-url https://testnet-rpc.monad.xyz --private-key $CONTRACT_OWNER_PK
# then point the pages at it: /beacon/1?drop=3 and /wall?drop=3
```

## Known shortcuts (deliberate, named in the pitch)

- Relayer is centralized and could censor. Production: session keys / EIP-7702.
- One ephemeral key per page load → one person can claim twice from two private windows.
  Production binds to a passkey, phone number, or loyalty account.
- A prepared accomplice with the page open can still relay a screenshot inside the
  freshness window — the design makes them *lose the race*, not fail validation.
- Server state (challenges, claim feed) is in-memory; a restart forgets unclaimed QRs.
