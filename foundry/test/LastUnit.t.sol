// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {LastUnit} from "../src/LastUnit.sol";

contract LastUnitTest is Test {
    LastUnit drop;

    uint256 constant BEACON_PK = 0xB0B;
    uint256 constant OTHER_PK = 0xBAD;
    address beacon;

    uint256 constant CP = 1;
    uint256 constant DROP = 1;

    function setUp() public {
        beacon = vm.addr(BEACON_PK);
        drop = new LastUnit();
        drop.setCheckpoint(CP, beacon, "stage");
        drop.createDrop(DROP, CP, 3, 10, "test drop");
        vm.roll(100);
    }

    function _sign(uint256 pk, bytes32 hash) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(pk, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)));
        return abi.encodePacked(r, s, v);
    }

    function _claimAs(uint256 playerPk, uint256 dropId, uint256 nonce, uint256 challengeBlock)
        internal
        returns (uint256 tokenId, uint32 rank)
    {
        bytes32 ch = drop.challengeHash(CP, nonce, challengeBlock);
        bytes memory beaconSig = _sign(BEACON_PK, ch);
        bytes memory playerSig = _sign(playerPk, drop.playerHash(ch, dropId));
        return drop.claim(dropId, nonce, challengeBlock, beaconSig, playerSig);
    }

    // 1. valid claim mints, rank increments from 1, tokenId = dropId*1e6 + rank
    function test_ValidClaimMintsAndRanks() public {
        (uint256 t1, uint32 r1) = _claimAs(0xA1, DROP, 1, block.number);
        (uint256 t2, uint32 r2) = _claimAs(0xA2, DROP, 2, block.number);
        assertEq(r1, 1);
        assertEq(r2, 2);
        assertEq(t1, DROP * 1e6 + 1);
        assertEq(t2, DROP * 1e6 + 2);
        assertEq(drop.ownerOf(t1), vm.addr(0xA1));
    }

    // 2. age == freshness passes; age == freshness + 1 reverts StaleChallenge
    function test_FreshnessBoundary() public {
        uint256 cb = block.number - 10; // age == freshness == 10
        _claimAs(0xA1, DROP, 1, cb);

        uint256 stale = block.number - 11;
        bytes32 ch = drop.challengeHash(CP, 2, stale);
        bytes memory beaconSig = _sign(BEACON_PK, ch);
        bytes memory playerSig = _sign(0xA2, drop.playerHash(ch, DROP));
        vm.expectRevert(abi.encodeWithSelector(LastUnit.StaleChallenge.selector, 11, 10));
        drop.claim(DROP, 2, stale, beaconSig, playerSig);
    }

    // 3. challengeBlock > block.number reverts FutureChallenge
    function test_FutureChallenge() public {
        uint256 future = block.number + 1;
        bytes32 ch = drop.challengeHash(CP, 1, future);
        bytes memory beaconSig = _sign(BEACON_PK, ch);
        bytes memory playerSig = _sign(0xA1, drop.playerHash(ch, DROP));
        vm.expectRevert(LastUnit.FutureChallenge.selector);
        drop.claim(DROP, 1, future, beaconSig, playerSig);
    }

    // 4. signature from a non-beacon key reverts BadBeaconSig
    function test_BadBeaconSig() public {
        bytes32 ch = drop.challengeHash(CP, 1, block.number);
        bytes memory beaconSig = _sign(OTHER_PK, ch);
        bytes memory playerSig = _sign(0xA1, drop.playerHash(ch, DROP));
        vm.expectRevert(LastUnit.BadBeaconSig.selector);
        drop.claim(DROP, 1, block.number, beaconSig, playerSig);
    }

    // 5. same player claiming same drop twice reverts AlreadyClaimed
    function test_AlreadyClaimed() public {
        _claimAs(0xA1, DROP, 1, block.number);
        bytes32 ch = drop.challengeHash(CP, 2, block.number);
        bytes memory beaconSig = _sign(BEACON_PK, ch);
        bytes memory playerSig = _sign(0xA1, drop.playerHash(ch, DROP));
        vm.expectRevert(LastUnit.AlreadyClaimed.selector);
        drop.claim(DROP, 2, block.number, beaconSig, playerSig);
    }

    // 6. claiming beyond supply reverts SoldOut
    function test_SoldOut() public {
        _claimAs(0xA1, DROP, 1, block.number);
        _claimAs(0xA2, DROP, 2, block.number);
        _claimAs(0xA3, DROP, 3, block.number);
        bytes32 ch = drop.challengeHash(CP, 4, block.number);
        bytes memory beaconSig = _sign(BEACON_PK, ch);
        bytes memory playerSig = _sign(0xA4, drop.playerHash(ch, DROP));
        vm.expectRevert(LastUnit.SoldOut.selector);
        drop.claim(DROP, 4, block.number, beaconSig, playerSig);
    }

    // ---------- redemption + soulbound ----------

    uint256 constant CASHIER_PK = 0xCA5;
    address cashier;

    function _setupCashier() internal {
        cashier = vm.addr(CASHIER_PK);
        drop.setCashier(cashier, true);
    }

    function _redeemSig(uint256 pk, uint256 tokenId, uint256 nonce, uint256 challengeBlock)
        internal
        view
        returns (bytes memory)
    {
        return _sign(pk, drop.redeemHash(tokenId, nonce, challengeBlock));
    }

    // R1. valid cashier + owner sig + fresh challenge -> burns, emits Redeemed, ownerOf reverts
    function test_RedeemBurnsAndEmits() public {
        _setupCashier();
        (uint256 tokenId,) = _claimAs(0xA1, DROP, 1, block.number);
        bytes memory sig = _redeemSig(0xA1, tokenId, 7, block.number);
        vm.expectEmit(true, true, true, true);
        emit LastUnit.Redeemed(DROP, tokenId, vm.addr(0xA1), cashier, uint64(block.number), uint64(block.number));
        vm.prank(cashier);
        drop.redeem(tokenId, 7, block.number, sig);
        vm.expectRevert("NOT_MINTED");
        drop.ownerOf(tokenId);
    }

    // R2. non-cashier caller reverts NotCashier
    function test_RedeemNotCashier() public {
        _setupCashier();
        (uint256 tokenId,) = _claimAs(0xA1, DROP, 1, block.number);
        bytes memory sig = _redeemSig(0xA1, tokenId, 7, block.number);
        vm.expectRevert(LastUnit.NotCashier.selector);
        drop.redeem(tokenId, 7, block.number, sig);
    }

    // R3. signature from a non-owner key reverts NotTokenOwner
    function test_RedeemNotTokenOwner() public {
        _setupCashier();
        (uint256 tokenId,) = _claimAs(0xA1, DROP, 1, block.number);
        bytes memory sig = _redeemSig(0xA2, tokenId, 7, block.number);
        vm.prank(cashier);
        vm.expectRevert(LastUnit.NotTokenOwner.selector);
        drop.redeem(tokenId, 7, block.number, sig);
    }

    // R4. redeeming the same token twice reverts TokenGone
    function test_RedeemTwiceTokenGone() public {
        _setupCashier();
        (uint256 tokenId,) = _claimAs(0xA1, DROP, 1, block.number);
        bytes memory sig1 = _redeemSig(0xA1, tokenId, 7, block.number);
        bytes memory sig2 = _redeemSig(0xA1, tokenId, 8, block.number);
        vm.prank(cashier);
        drop.redeem(tokenId, 7, block.number, sig1);
        vm.prank(cashier);
        vm.expectRevert(LastUnit.TokenGone.selector);
        drop.redeem(tokenId, 8, block.number, sig2);
    }

    // R5. age == freshness passes; age == freshness + 1 reverts StaleChallenge
    function test_RedeemFreshnessBoundary() public {
        _setupCashier();
        (uint256 tokenId,) = _claimAs(0xA1, DROP, 1, block.number);
        uint256 ok = block.number - 10; // freshness == 10
        bytes memory sigOk = _redeemSig(0xA1, tokenId, 7, ok);
        vm.prank(cashier);
        drop.redeem(tokenId, 7, ok, sigOk);

        (uint256 tokenId2,) = _claimAs(0xA2, DROP, 2, block.number);
        uint256 stale = block.number - 11;
        bytes memory sig = _redeemSig(0xA2, tokenId2, 9, stale);
        vm.prank(cashier);
        vm.expectRevert(abi.encodeWithSelector(LastUnit.StaleChallenge.selector, 11, 10));
        drop.redeem(tokenId2, 9, stale, sig);
    }

    // R6. transferFrom and both safeTransferFrom overloads revert Soulbound
    function test_Soulbound() public {
        (uint256 tokenId,) = _claimAs(0xA1, DROP, 1, block.number);
        address holder = vm.addr(0xA1);
        vm.startPrank(holder);
        vm.expectRevert(LastUnit.Soulbound.selector);
        drop.transferFrom(holder, address(this), tokenId);
        vm.expectRevert(LastUnit.Soulbound.selector);
        drop.safeTransferFrom(holder, address(this), tokenId);
        vm.expectRevert(LastUnit.Soulbound.selector);
        drop.safeTransferFrom(holder, address(this), tokenId, "");
        vm.stopPrank();
    }

    // 7. two drops sharing a checkpoint: independent ranks and token ids
    function test_DropsShareCheckpointIndependently() public {
        drop.createDrop(2, CP, 5, 10, "second drop");
        (uint256 tA, uint32 rA) = _claimAs(0xA1, DROP, 1, block.number);
        (uint256 tB, uint32 rB) = _claimAs(0xA1, 2, 2, block.number);
        assertEq(rA, 1);
        assertEq(rB, 1);
        assertEq(tA, 1 * 1e6 + 1);
        assertEq(tB, 2 * 1e6 + 1);
        (, uint32 claimed1,,,) = drop.dropStatus(1);
        (, uint32 claimed2,,,) = drop.dropStatus(2);
        assertEq(claimed1, 1);
        assertEq(claimed2, 1);
    }
}
