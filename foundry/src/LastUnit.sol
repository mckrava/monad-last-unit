// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "solmate/tokens/ERC721.sol";

/// Verified-presence flash drop. A claim is valid only with a fresh,
/// beacon-signed challenge; transaction ordering decides who gets scarce units.
contract LastUnit is ERC721 {
    error DropInactive();
    error SoldOut();
    error FutureChallenge();
    error StaleChallenge(uint256 age, uint256 max);
    error BadBeaconSig();
    error BadPlayerSig();
    error AlreadyClaimed();
    error BadSigLength();
    error NotOwner();
    error NotCashier();
    error NotTokenOwner();
    error TokenGone();
    error Soulbound();

    event Claimed(
        uint256 indexed dropId,
        address indexed player,
        uint256 indexed tokenId,
        uint32 rank,
        uint32 supply,
        uint64 challengeBlock,
        uint64 claimBlock
    );

    struct Checkpoint {
        address beacon;
        string label;
    }

    struct Drop {
        uint256 cpId;
        uint32 supply;
        uint32 claimed; // intentional hot slot: this IS the race
        uint32 freshness; // max challenge age in blocks
        bool active;
        string name;
    }

    address public immutable owner;
    mapping(uint256 => Checkpoint) public checkpoints;
    mapping(uint256 => Drop) public drops;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    mapping(address => bool) public cashiers;

    event CashierSet(address indexed cashier, bool ok);
    event Redeemed(
        uint256 indexed dropId,
        uint256 indexed tokenId,
        address indexed player,
        address cashier,
        uint64 challengeBlock,
        uint64 redeemBlock
    );

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() ERC721("Last Unit", "UNIT") {
        owner = msg.sender;
    }

    function setCheckpoint(uint256 cpId, address beacon, string calldata label) external onlyOwner {
        checkpoints[cpId] = Checkpoint(beacon, label);
    }

    function createDrop(uint256 dropId, uint256 cpId, uint32 supply, uint32 freshness, string calldata name)
        external
        onlyOwner
    {
        drops[dropId] = Drop(cpId, supply, 0, freshness, true, name);
    }

    function setActive(uint256 dropId, bool active) external onlyOwner {
        drops[dropId].active = active;
    }

    function challengeHash(uint256 cpId, uint256 nonce, uint256 challengeBlock) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), cpId, nonce, challengeBlock));
    }

    function playerHash(bytes32 challenge, uint256 dropId) public pure returns (bytes32) {
        return keccak256(abi.encode(challenge, dropId));
    }

    function dropStatus(uint256 dropId)
        external
        view
        returns (uint32 supply, uint32 claimed, uint32 freshness, bool active, string memory name)
    {
        Drop storage d = drops[dropId];
        return (d.supply, d.claimed, d.freshness, d.active, d.name);
    }

    function claim(uint256 dropId, uint256 nonce, uint256 challengeBlock, bytes calldata beaconSig, bytes calldata playerSig)
        external
        returns (uint256 tokenId, uint32 rank)
    {
        Drop storage d = drops[dropId];
        if (!d.active) revert DropInactive();
        if (challengeBlock > block.number) revert FutureChallenge();
        uint256 age = block.number - challengeBlock;
        if (age > d.freshness) revert StaleChallenge(age, d.freshness);

        bytes32 ch = challengeHash(d.cpId, nonce, challengeBlock);
        if (_recover(ch, beaconSig) != checkpoints[d.cpId].beacon) revert BadBeaconSig();

        address player = _recover(playerHash(ch, dropId), playerSig);
        if (player == address(0)) revert BadPlayerSig();
        if (hasClaimed[dropId][player]) revert AlreadyClaimed();
        if (d.claimed >= d.supply) revert SoldOut();

        rank = ++d.claimed;
        tokenId = dropId * 1e6 + rank;
        hasClaimed[dropId][player] = true;
        _mint(player, tokenId);

        emit Claimed(dropId, player, tokenId, rank, d.supply, uint64(challengeBlock), uint64(block.number));
    }

    function setCashier(address c, bool ok) external onlyOwner {
        cashiers[c] = ok;
        emit CashierSet(c, ok);
    }

    /// @dev uint8(1) is a domain separator so a claim signature can never be replayed as a redeem.
    function redeemHash(uint256 tokenId, uint256 nonce, uint256 challengeBlock) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), uint8(1), tokenId, nonce, challengeBlock));
    }

    function redeem(uint256 tokenId, uint256 nonce, uint256 challengeBlock, bytes calldata ownerSig) external {
        if (!cashiers[msg.sender]) revert NotCashier();
        if (challengeBlock > block.number) revert FutureChallenge();

        uint256 dropId = tokenId / 1_000_000;
        uint256 age = block.number - challengeBlock;
        uint32 f = drops[dropId].freshness;
        if (age > f) revert StaleChallenge(age, f);

        address holder = _ownerOf[tokenId]; // solmate internal mapping; ownerOf() reverts on burned
        if (holder == address(0)) revert TokenGone();

        // _recover applies the EIP-191 prefix internally
        if (_recover(redeemHash(tokenId, nonce, challengeBlock), ownerSig) != holder) {
            revert NotTokenOwner();
        }

        _burn(tokenId);
        emit Redeemed(dropId, tokenId, holder, msg.sender, uint64(challengeBlock), uint64(block.number));
    }

    /// @dev Soulbound. solmate's safeTransferFrom overloads delegate to transferFrom,
    ///      so this single override covers all transfer paths.
    function transferFrom(address, address, uint256) public pure override {
        revert Soulbound();
    }

    function _recover(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) revert BadSigLength();
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        bytes32 signed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        return ecrecover(signed, v, r, s);
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        return string(
            abi.encodePacked(
                'data:application/json,{"name":"LastUnit%20%23',
                _toString(tokenId),
                '","description":"Claimed%20in%20person%20on%20Monad."}'
            )
        );
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
