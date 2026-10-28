// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PayRouterTestBase} from "./PayRouter.Base.t.sol";
import {PayRouter, PermitTransferFrom, SignatureTransferDetails} from "../PayRouter.sol";
import {MockPermit2} from "../test-helpers/MockPermit2.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract PayRouterSendTest is PayRouterTestBase {

    // ─────────────────────────────────────────────────────────────
    // SEND — happy path
    // ─────────────────────────────────────────────────────────────

    function test_Send_HappyPath_Tier0() public {
        uint256 amount = 5 * USDC_6; // exactly at Tier-0 per-payment cap

        vm.prank(alice);
        router.send(_buildPermit(amount), DUMMY_SIG, bob, amount);

        // Permit2 mock was called
        assertEq(permit2.permitCallCount(), 1);
        assertEq(permit2.lastOwner(), alice);
        assertEq(permit2.lastDetailsTo(), bob);
        assertEq(permit2.lastDetailsRequestedAmount(), amount);
    }

    function test_Send_HappyPath_EmitsSentEvent() public {
        uint256 amount = 5 * USDC_6;

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(router));
        emit PayRouter.Sent(alice, bob, amount);
        router.send(_buildPermit(amount), DUMMY_SIG, bob, amount);
    }

    function test_Send_TransfersTokens() public {
        uint256 amount  = 5 * USDC_6;
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.prank(alice);
        router.send(_buildPermit(amount), DUMMY_SIG, bob, amount);

        assertEq(usdc.balanceOf(bob), bobBefore + amount);
    }

    // ─────────────────────────────────────────────────────────────
    // SEND — permissionless model: only global cap enforced
    // ─────────────────────────────────────────────────────────────

    function test_Send_Tier0_AboveOldTierCap_NowSucceeds() public {
        // Permissionless model: alice (Tier-0) can send 6 USDC even though the
        // old Tier-0 per-payment cap was 5 USDC.  Per-tier caps are not enforced.
        uint256 amount = 6 * USDC_6; // > old T0_PER_PAYMENT (5), still <= GLOBAL_CAP (25)

        vm.prank(alice);
        router.send(_buildPermit(amount), DUMMY_SIG, bob, amount);

        assertEq(permit2.permitCallCount(), 1, "transfer executed");
    }

    function test_RevertSend_ExceedsGlobalCap() public {
        // The global per-payment cap (25 USDC) is still enforced for all wallets.
        uint256 amount = 26 * USDC_6;

        vm.prank(alice);
        vm.expectRevert(PayRouter.ExceedsGlobalCap.selector);
        router.send(_buildPermit(amount), DUMMY_SIG, bob, amount);
    }

    function test_Send_MultiplePayments_DailyDataRecorded() public {
        // Daily spend is still recorded (data for future governance).
        // No daily-cap revert fires at launch — only global per-payment cap is active.
        uint256 amount = 5 * USDC_6;

        for (uint256 i = 0; i < 10; i++) {
            vm.prank(alice);
            router.send(_buildPermit(amount), DUMMY_SIG, bob, amount);
        }

        uint256 day = block.timestamp / 1 days;
        assertEq(router.dailySpend(alice, day), 50 * USDC_6, "daily spend recorded");
        // Note: no revert because daily-cap enforcement was removed.
        // A further send still succeeds as long as it is within globalPerPaymentCap.
        vm.prank(alice);
        router.send(_buildPermit(amount), DUMMY_SIG, bob, amount);
        assertEq(permit2.permitCallCount(), 11, "all 11 sends executed");
    }

    function test_Send_DailyCapResets_AfterWarp() public {
        uint256 amount = 5 * USDC_6;

        vm.prank(alice);
        router.send(_buildPermit(amount), DUMMY_SIG, bob, amount);

        // warp forward exactly 1 day
        vm.warp(block.timestamp + 1 days);

        // re-seed alice (used tokens in first send)
        usdc.mint(alice, amount);

        vm.prank(alice);
        router.send(_buildPermit(amount), DUMMY_SIG, bob, amount);

        assertEq(permit2.permitCallCount(), 2);
    }

    // ─────────────────────────────────────────────────────────────
    // SEND — paused
    // ─────────────────────────────────────────────────────────────

    function test_RevertSend_WhenPaused() public {
        vm.prank(admin);
        router.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        router.send(_buildPermit(5 * USDC_6), DUMMY_SIG, bob, 5 * USDC_6);
    }

    // ─────────────────────────────────────────────────────────────
    // SEND — invalid inputs
    // ─────────────────────────────────────────────────────────────

    function test_RevertSend_ZeroRecipient() public {
        vm.prank(alice);
        vm.expectRevert(PayRouter.ZeroAddress.selector);
        router.send(_buildPermit(5 * USDC_6), DUMMY_SIG, address(0), 5 * USDC_6);
    }

    function test_RevertSend_ZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(PayRouter.InvalidAmount.selector);
        router.send(_buildPermit(0), DUMMY_SIG, bob, 0);
    }

    function test_RevertSend_AmountMismatch() public {
        // permit says 5 USDC but send says 4 USDC
        PermitTransferFrom memory p = _buildPermit(5 * USDC_6);
        vm.prank(alice);
        vm.expectRevert(PayRouter.InvalidAmount.selector);
        router.send(p, DUMMY_SIG, bob, 4 * USDC_6);
    }

    // ─────────────────────────────────────────────────────────────
    // SENDTOHANDLE — happy path
    // ─────────────────────────────────────────────────────────────

    function test_SendToHandle_HappyPath() public {
        // Bob claims a handle
        vm.prank(bob);
        handleReg.claimHandle("bobhandle");

        uint256 amount = 5 * USDC_6;

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(router));
        emit PayRouter.SentToHandle(alice, bob, "bobhandle", amount);
        router.sendToHandle(_buildPermit(amount), DUMMY_SIG, "bobhandle", amount);

        // Permit2 was called with recipient = bob
        assertEq(permit2.lastDetailsTo(), bob);
    }

    function test_RevertSendToHandle_HandleNotFound() public {
        uint256 amount = 5 * USDC_6;

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PayRouter.HandleNotFound.selector, "nobody"));
        router.sendToHandle(_buildPermit(amount), DUMMY_SIG, "nobody", amount);
    }

    function test_RevertSendToHandle_WhenPaused() public {
        vm.prank(bob);
        handleReg.claimHandle("bobhandle2");

        vm.prank(admin);
        router.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        router.sendToHandle(_buildPermit(5 * USDC_6), DUMMY_SIG, "bobhandle2", 5 * USDC_6);
    }

    // ─────────────────────────────────────────────────────────────
    // REQUESTPAY — happy path
    // ─────────────────────────────────────────────────────────────

    function test_RequestPay_HappyPath_EmitsEvent() public {
        uint256 amount    = 5 * USDC_6;
        bytes32 requestId = keccak256("req-001");

        vm.prank(alice);
        vm.expectEmit(true, true, true, true, address(router));
        emit PayRouter.RequestPaid(alice, bob, requestId, amount);
        router.requestPay(_buildPermit(amount), DUMMY_SIG, requestId, bob, amount);
    }

    function test_RequestPay_TransfersTokens() public {
        uint256 amount    = 5 * USDC_6;
        bytes32 requestId = keccak256("req-002");
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.prank(alice);
        router.requestPay(_buildPermit(amount), DUMMY_SIG, requestId, bob, amount);

        assertEq(usdc.balanceOf(bob), bobBefore + amount);
    }

    function test_RevertRequestPay_WhenPaused() public {
        vm.prank(admin);
        router.pause();

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        router.requestPay(_buildPermit(5 * USDC_6), DUMMY_SIG, bytes32(0), bob, 5 * USDC_6);
    }

    // ─────────────────────────────────────────────────────────────
    // PERMIT2 SECURITY — third-party relay
    // ─────────────────────────────────────────────────────────────

    /// @dev Security: Real Permit2 enforces that the signature was produced by `owner`.
    ///      A relay attacker cannot supply a different owner and re-use a stolen signature.
    ///      We model this with a strict MockPermit2 (enforceSenderCheck=true) deployed
    ///      locally in this test, verifying that owner != msg.sender causes a revert.
    ///      The router always passes msg.sender as owner, so the only way to trigger a
    ///      victim's transfer is to control their private key (i.e., steal the sig).
    function test_Permit2_ThirdPartyRelayReverts() public {
        // Deploy a strict MockPermit2 that enforces owner == msg.sender
        MockPermit2 strictPermit2 = new MockPermit2(true);

        uint256 amount   = 5 * USDC_6;
        address attacker = makeAddr("attacker");

        PermitTransferFrom memory permit = _buildPermit(amount);

        // Attacker (msg.sender) tries to specify alice as the owner — mock rejects this.
        vm.prank(attacker);
        vm.expectRevert("MockPermit2: owner != msg.sender");
        strictPermit2.permitTransferFrom(
            permit,
            SignatureTransferDetails({to: attacker, requestedAmount: amount}),
            alice, // owner != msg.sender (attacker) → revert
            DUMMY_SIG
        );
    }
}
