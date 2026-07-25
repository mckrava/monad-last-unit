#!/usr/bin/env bash
set -euo pipefail

CONTRACT=0x0675a899e19Fe66D99dAD97e76763A49B8aa3A74
RPC=https://testnet-rpc.monad.xyz
CPID=1
SUPPLY=2
FRESHNESS=50

# 10..39 — стартуємо з 10, щоб не зачепити наявні 1 та 4-9
for i in $(seq 10 39); do
  printf "drop %s ... " "$i"
  cast send "$CONTRACT" \
    "createDrop(uint256,uint256,uint32,uint32,string)" \
    "$i" "$CPID" "$SUPPLY" "$FRESHNESS" "FINAL 2" \
    --rpc-url "$RPC" \
    --private-key "6557b6c2d63e6b9aba90bd19ab440832f273139ae5340ff5c2b0d06424f2e20a" \
    --gas-limit 300000 \
    --async > /dev/null
  echo "sent"
done

echo
echo "waiting for inclusion..."
sleep 8

for i in $(seq 10 39); do
  printf "%s: " "$i"
  cast call "$CONTRACT" "dropStatus(uint256)(uint32,uint32,uint32,bool,string)" "$i" \
    --rpc-url "$RPC" | tr '\n' ' '
  echo
done