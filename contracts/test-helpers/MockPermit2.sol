// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MockERC20} from "./MockERC20.sol";
import {PermitTransferFrom, SignatureTransferDetails} from "../PayRouter.sol";

/// @dev Mock Permit2 matching the CANONICAL Uniswap Permit2 ISignatureTransfer interface.
///   6-parameter permitWitnessTransferFrom: (permit, transferDetails, owner, witness, witnessTypeString, sig)
///   Records all call arguments and simulates the token pull.
///   Optional enforceSenderCheck mirrors real Permit2's owner==msg.sender requirement.
contract MockPermit2 {
    // Last permitTransferFrom call
    address  public lastPermitToken;
    uint256  public lastPermitAmount;
    address  public lastDetailsTo;
    uint256  public lastDetailsRequestedAmount;
    address  public lastOwner;
    bytes    public lastSig;

    // Last permitWitnessTransferFrom call
    address  public lastWitnessDetailsTo;
    address  public lastWitnessOwner;
    bytes32  public lastWitnessValue;          // the witness bytes32 hash
    string   public lastWitnessTypeString;     // the witnessTypeString
    bytes    public lastWitnessSig;

    uint256 public permitCallCount;
    uint256 public witnessCallCount;

    /// @dev When true, reverts if owner != msg.sender (mirrors real Permit2 security).
    bool public enforceSenderCheck;

    constructor(bool _enforceSenderCheck) {
        enforceSenderCheck = _enforceSenderCheck;
    }

    /// @dev Canonical 4-parameter permitTransferFrom (non-witness).
    function permitTransferFrom(
        PermitTransferFrom memory permit,
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

        MockERC20(permit.permitted.token).transferFrom(owner, transferDetails.to, transferDetails.requestedAmount);
    }

    /// @dev Canonical 6-parameter permitWitnessTransferFrom.
    ///   witness       = keccak256(abi.encode(TYPEHASH, ...fields...))  — computed by the calling contract
    ///   witnessTypeString = full EIP-712 type string including TokenPermissions
    function permitWitnessTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external {
        if (enforceSenderCheck) {
            require(owner == msg.sender, "MockPermit2: owner != msg.sender");
        }

        lastWitnessDetailsTo    = transferDetails.to;
        lastWitnessOwner        = owner;
        lastWitnessValue        = witness;
        lastWitnessTypeString   = witnessTypeString;
        lastWitnessSig          = signature;
        ++witnessCallCount;

        MockERC20(permit.permitted.token).transferFrom(owner, transferDetails.to, transferDetails.requestedAmount);
    }
}
