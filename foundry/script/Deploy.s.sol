// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FlashDrop} from "../src/FlashDrop.sol";

contract Deploy is Script {
    function run() external {
        address beacon = vm.envAddress("BEACON_ADDR");
        vm.startBroadcast();
        FlashDrop drop = new FlashDrop();
        drop.setCheckpoint(1, beacon, "Main Stage");
        drop.createDrop(1, 1, 50, 50, "Doorbuster x50");
        drop.createDrop(2, 1, 2, 50, "Last Units x2");
        vm.stopBroadcast();
        console.log("FlashDrop deployed at:", address(drop));
    }
}
