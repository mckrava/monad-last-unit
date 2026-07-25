// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LastUnit} from "../src/LastUnit.sol";

contract Deploy is Script {
    function run() external {
        address beacon = vm.envAddress("BEACON_ADDR");
        address cashier = vm.envAddress("CASHIER_ADDR");
        vm.startBroadcast();
        LastUnit drop = new LastUnit();
        drop.setCheckpoint(1, beacon, "NORTHSIDE / QUEEN W");
        drop.setCashier(cashier, true);
        drop.createDrop(1, 1, 50, 50, "PHANTOM TRAIL 002 EMBER");
        // spare stage drops: any rehearsal phone burns its hasClaimed slot per drop
        drop.createDrop(4, 1, 2, 50, "FINAL 2");
        drop.createDrop(5, 1, 2, 50, "FINAL 2");
        drop.createDrop(6, 1, 2, 50, "FINAL 2");
        drop.createDrop(7, 1, 2, 50, "FINAL 2");
        vm.stopBroadcast();
        console.log("LastUnit deployed at:", address(drop));
    }
}
