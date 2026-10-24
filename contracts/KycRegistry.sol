// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract KycRegistry is AccessControl {
    struct TierRecord {
        uint8 tier;
        uint64 expiry;
    }

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    mapping(address => TierRecord) private _tiers;

    error InvalidTier(uint8 tier);
    error InvalidExpiry();
    error ZeroAddress();

    event TierSet(address indexed wallet, uint8 tier, uint64 expiry);
    event TierRevoked(address indexed wallet);

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /**
     * @notice Sets a tier record for a wallet.
     * @dev Callable only by accounts with VERIFIER_ROLE.
     * @param wallet Wallet address whose tier record is updated.
     * @param tier Tier value to store (0, 1, or 2).
     * @param expiry Expiry timestamp for the tier record.
     */
    function setTier(address wallet, uint8 tier, uint64 expiry) external onlyRole(VERIFIER_ROLE) {
        if (wallet == address(0)) revert ZeroAddress();
        if (tier > 2) revert InvalidTier(tier);
        if (expiry <= block.timestamp) revert InvalidExpiry();

        _tiers[wallet] = TierRecord({tier: tier, expiry: expiry});

        emit TierSet(wallet, tier, expiry);
    }

    /**
     * @notice Revokes a wallet tier record.
     * @dev Callable only by accounts with VERIFIER_ROLE.
     * @param wallet Wallet address whose tier record is revoked.
     */
    function revokeTier(address wallet) external onlyRole(VERIFIER_ROLE) {
        if (wallet == address(0)) revert ZeroAddress();

        _tiers[wallet] = TierRecord({tier: 0, expiry: 0});

        emit TierRevoked(wallet);
    }

    /**
     * @notice Returns the effective tier and stored expiry for a wallet.
     * @dev If the stored expiry is zero, returns (0, 0). If expired, returns (0, stored expiry).
     * @param wallet Wallet address to query.
     * @return tier Effective tier value.
     * @return expiry Stored expiry timestamp.
     */
    function getTier(address wallet) public view returns (uint8 tier, uint64 expiry) {
        TierRecord memory record = _tiers[wallet];

        if (record.expiry == 0) {
            return (0, 0);
        }

        if (block.timestamp >= record.expiry) {
            return (0, record.expiry);
        }

        return (record.tier, record.expiry);
    }

    /**
     * @notice Returns only the effective tier for a wallet.
     * @param wallet Wallet address to query.
     * @return tier Effective tier value (0 when unset or expired).
     */
    function effectiveTier(address wallet) public view returns (uint8 tier) {
        (tier, ) = getTier(wallet);
    }
}
