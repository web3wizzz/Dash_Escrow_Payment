// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {KycRegistry} from "../KycRegistry.sol";

contract KycRegistryTest is Test {
    KycRegistry internal kyc;

    address internal admin    = makeAddr("admin");
    address internal verifier = makeAddr("verifier");
    address internal alice    = makeAddr("alice");
    address internal bob      = makeAddr("bob");

    event TierSet(address indexed wallet, uint8 tier, uint64 expiry);
    event TierRevoked(address indexed wallet);

    uint64 internal constant FAR_FUTURE = type(uint64).max;

    function setUp() public {
        kyc = new KycRegistry(admin);

        // Grant verifier role from admin — read role constant before prank so the
        // external view call doesn't consume the prank.
        bytes32 verifierRole = kyc.VERIFIER_ROLE();
        vm.prank(admin);
        kyc.grantRole(verifierRole, verifier);
    }

    // ─────────────────────────────────────────────────────────────
    // DEPLOYMENT
    // ─────────────────────────────────────────────────────────────

    function test_AdminHasDefaultAdminRole() public view {
        assertTrue(kyc.hasRole(kyc.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_VerifierHasVerifierRole() public view {
        assertTrue(kyc.hasRole(kyc.VERIFIER_ROLE(), verifier));
    }

    function test_RevertConstructor_ZeroAdmin() public {
        vm.expectRevert(KycRegistry.ZeroAddress.selector);
        new KycRegistry(address(0));
    }

    // ─────────────────────────────────────────────────────────────
    // HAPPY PATH — setTier
    // ─────────────────────────────────────────────────────────────

    function test_SetTier_Tier1_FutureExpiry() public {
        uint64 expiry = uint64(block.timestamp + 1 days);

        vm.prank(verifier);
        kyc.setTier(alice, 1, expiry);

        (uint8 tier, uint64 storedExpiry) = kyc.getTier(alice);
        assertEq(tier, 1);
        assertEq(storedExpiry, expiry);
    }

    function test_SetTier_EffectiveTierMatchesTier() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(verifier);
        kyc.setTier(alice, 2, expiry);

        assertEq(kyc.effectiveTier(alice), 2);
    }

    function test_SetTier_EmitsEvent() public {
        uint64 expiry = uint64(block.timestamp + 1 days);

        vm.prank(verifier);
        vm.expectEmit(true, false, false, true, address(kyc));
        emit TierSet(alice, 1, expiry);
        kyc.setTier(alice, 1, expiry);
    }

    // ─────────────────────────────────────────────────────────────
    // EXPIRY BEHAVIOUR
    // ─────────────────────────────────────────────────────────────

    function test_EffectiveTier_ReturnsZeroAfterExpiry() public {
        uint64 expiry = uint64(block.timestamp + 1);

        vm.prank(verifier);
        kyc.setTier(alice, 1, expiry);

        // warp past expiry
        vm.warp(block.timestamp + 2);

        assertEq(kyc.effectiveTier(alice), 0);
    }

    function test_GetTier_ReturnsStoredExpiryAfterExpiry() public {
        uint64 expiry = uint64(block.timestamp + 1);

        vm.prank(verifier);
        kyc.setTier(alice, 1, expiry);

        vm.warp(block.timestamp + 2);

        (uint8 tier, uint64 storedExpiry) = kyc.getTier(alice);
        assertEq(tier, 0);
        assertEq(storedExpiry, expiry);
    }

    function test_GetTier_ReturnsZeroZeroWhenNeverSet() public view {
        (uint8 tier, uint64 expiry) = kyc.getTier(alice);
        assertEq(tier, 0);
        assertEq(expiry, 0);
    }

    // ─────────────────────────────────────────────────────────────
    // REVERT — access control on setTier / revokeTier
    // ─────────────────────────────────────────────────────────────

    function test_RevertSetTier_NonVerifier() public {
        bytes32 vRole = kyc.VERIFIER_ROLE();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                alice,
                vRole
            )
        );
        kyc.setTier(bob, 1, FAR_FUTURE);
    }

    function test_RevertRevokeTier_NonVerifier() public {
        bytes32 vRole = kyc.VERIFIER_ROLE();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                alice,
                vRole
            )
        );
        kyc.revokeTier(bob);
    }

    // ─────────────────────────────────────────────────────────────
    // REVERT — invalid inputs
    // ─────────────────────────────────────────────────────────────

    function test_RevertSetTier_TierAboveTwo() public {
        vm.prank(verifier);
        vm.expectRevert(abi.encodeWithSelector(KycRegistry.InvalidTier.selector, uint8(3)));
        kyc.setTier(alice, 3, FAR_FUTURE);
    }

    function test_RevertSetTier_ExpiryAtNow() public {
        vm.prank(verifier);
        vm.expectRevert(KycRegistry.InvalidExpiry.selector);
        kyc.setTier(alice, 1, uint64(block.timestamp));
    }

    function test_RevertSetTier_ExpiryInPast() public {
        vm.warp(1000);
        vm.prank(verifier);
        vm.expectRevert(KycRegistry.InvalidExpiry.selector);
        kyc.setTier(alice, 1, uint64(block.timestamp - 1));
    }

    function test_RevertSetTier_ZeroAddress() public {
        vm.prank(verifier);
        vm.expectRevert(KycRegistry.ZeroAddress.selector);
        kyc.setTier(address(0), 1, FAR_FUTURE);
    }

    function test_RevertRevokeTier_ZeroAddress() public {
        vm.prank(verifier);
        vm.expectRevert(KycRegistry.ZeroAddress.selector);
        kyc.revokeTier(address(0));
    }

    // ─────────────────────────────────────────────────────────────
    // REVOKE
    // ─────────────────────────────────────────────────────────────

    function test_RevokeTier_ClearsTier() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(verifier);
        kyc.setTier(alice, 1, expiry);

        vm.prank(verifier);
        kyc.revokeTier(alice);

        assertEq(kyc.effectiveTier(alice), 0);
    }

    function test_RevokeTier_EmitsEvent() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(verifier);
        kyc.setTier(alice, 1, expiry);

        vm.prank(verifier);
        vm.expectEmit(true, false, false, false, address(kyc));
        emit TierRevoked(alice);
        kyc.revokeTier(alice);
    }

    function test_RevokeTier_GetTierReturnsZeroZero() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(verifier);
        kyc.setTier(alice, 1, expiry);

        vm.prank(verifier);
        kyc.revokeTier(alice);

        (uint8 tier, uint64 storedExpiry) = kyc.getTier(alice);
        assertEq(tier, 0);
        assertEq(storedExpiry, 0);
    }

    // ─────────────────────────────────────────────────────────────
    // ROLE MANAGEMENT — admin grants verifier, new verifier sets tiers
    // ─────────────────────────────────────────────────────────────

    function test_AdminCanGrantVerifierRole() public {
        address newVerifier = makeAddr("newVerifier");
        bytes32 vRole = kyc.VERIFIER_ROLE();

        vm.prank(admin);
        kyc.grantRole(vRole, newVerifier);

        assertTrue(kyc.hasRole(vRole, newVerifier));
    }

    function test_NewVerifierCanSetTier() public {
        address newVerifier = makeAddr("newVerifier");
        bytes32 vRole = kyc.VERIFIER_ROLE();

        vm.prank(admin);
        kyc.grantRole(vRole, newVerifier);

        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(newVerifier);
        kyc.setTier(alice, 2, expiry);

        assertEq(kyc.effectiveTier(alice), 2);
    }

    function test_AdminCanRevokeVerifierRole() public {
        bytes32 vRole = kyc.VERIFIER_ROLE();

        vm.prank(admin);
        kyc.revokeRole(vRole, verifier);

        assertFalse(kyc.hasRole(vRole, verifier));

        vm.prank(verifier);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                verifier,
                vRole
            )
        );
        kyc.setTier(alice, 1, FAR_FUTURE);
    }

    // ─────────────────────────────────────────────────────────────
    // FUZZ
    // ─────────────────────────────────────────────────────────────

    function testFuzz_SetTier_ValidInputs(address wallet, uint8 tier, uint64 expiry) public {
        vm.assume(wallet != address(0));
        tier = uint8(bound(tier, 0, 2));
        expiry = uint64(bound(expiry, block.timestamp + 1, type(uint64).max));

        vm.prank(verifier);
        kyc.setTier(wallet, tier, expiry);

        assertEq(kyc.effectiveTier(wallet), tier);
    }

    function testFuzz_SetTier_InvalidTierReverts(uint8 tier) public {
        tier = uint8(bound(tier, 3, type(uint8).max));
        vm.prank(verifier);
        vm.expectRevert(abi.encodeWithSelector(KycRegistry.InvalidTier.selector, tier));
        kyc.setTier(alice, tier, FAR_FUTURE);
    }
}
