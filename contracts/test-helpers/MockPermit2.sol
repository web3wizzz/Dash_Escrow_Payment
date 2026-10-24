// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MockERC20} from "./MockERC20.sol";
// Import structs from PayRouter to avoid redefinition conflicts
import {PermitTransferFrom, PermitWitnessTransferFrom, SignatureTransferDetails} from "../PayRouter.sol";

/// @dev Mock Permit2 that:
///   1. Records the last call arguments as flat fields.
///   2. Transfers tokens from `owner` to `transferDetails.to` (simulating real Permit2).
///   3. Optionally enforces owner == msg.sender (mirrors real Permit2 security).
contract MockPermit2 {
    // Last permitTransferFrom call — flat fields (structs cannot be returned via auto-getter)
    address  public lastPermitToken;
    uint256  public lastPermitAmount;
    address  public lastDetailsTo;
    uint256  public lastDetailsRequestedAmount;
    address  public lastOwner;
    bytes    public lastSig;

    // Last permitWitnessTransferFrom call
    address  public lastWitnessDetailsTo;
    address  public lastWitnessOwner;
    bytes32  public lastWitnessTypeHash;
    bytes32  public lastWitnessValue;
    bytes    public lastWitnessSig;

    uint256 public permitCallCount;
    uint256 public witnessCallCount;

    /// @dev When true, reverts if owner != msg.sender (mirrors real Permit2 security).
    bool public enforceSenderCheck;

    constructor(bool _enforceSenderCheck) {
        enforceSenderCheck = _enforceSenderCheck;
    }

    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external {
        if (enforceSenderCheck) {
            require(owner == msg.sender, "MockPermit2: owner != msg.sender");
        }

        lastPermitToken            = permit.permitted.token;
        lastPermitAmount           = permit.permitted.amount;
        lastDetailsTo              = transferDetails.to;
        lastDetailsRequestedAmount = transferDetails.requestedAmount;
        lastOwner                  = owner;
        lastSig                    = signature;
        ++permitCallCount;

        // Simulate the actual token pull
        MockERC20(permit.permitted.token).transferFrom(owner, transferDetails.to, transferDetails.requestedAmount);
    }

    function permitWitnessTransferFrom(
        PermitWitnessTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witnessTypeHash,
        bytes calldata signature
    ) external {
        if (enforceSenderCheck) {
            require(owner == msg.sender, "MockPermit2: owner != msg.sender");
        }

        lastWitnessDetailsTo = transferDetails.to;
        lastWitnessOwner     = owner;
        lastWitnessTypeHash  = witnessTypeHash;
        lastWitnessValue     = permit.witness;
        lastWitnessSig       = signature;
        ++witnessCallCount;

        // Simulate the actual token pull
        MockERC20(permit.permitted.token).transferFrom(owner, transferDetails.to, transferDetails.requestedAmount);
    }
}
