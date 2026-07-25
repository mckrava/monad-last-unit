// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {LastUnit} from "../src/LastUnit.sol";

contract Deploy is Script {
    function run() external {
        address beacon = vm.envAddress("BEACON_ADDR");
        vm.startBroadcast();
        LastUnit drop = new LastUnit();
        drop.setCheckpoint(1, beacon, "NORTHSIDE / QUEEN W");
        drop.createDrop(1, 1, 50, 50, "PHANTOM TRAIL 002 EMBER");
        drop.createDrop(2, 1, 2, 50, "PHANTOM TRAIL 002 EMBER / STAGE");
        vm.stopBroadcast();
        console.log("LastUnit deployed at:", address(drop));
    }
}
