// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ScheduledPayoutsTestBase} from "./ScheduledPayouts.Base.t.sol";
import {ScheduledPayouts, PermitTransferFrom}
    from "../ScheduledPayouts.sol";

// ─────────────────────────────────────────────────────────────────────────────
// STREAMING
// ─────────────────────────────────────────────────────────────────────────────
contract ScheduledPayoutsStreamingTest is ScheduledPayoutsTestBase {

    uint128 constant AMT    = 100e6;   // 100 USDC
    uint64  constant WINDOW = 1000;    // 1000-second window (easy 10% increments)

    function _setupStreaming()
        internal
        returns (bytes32 id, uint64 start, uint64 end_)
    {
        start = uint64(block.timestamp);
        end_  = start + WINDOW;
        id    = _depositAs(alice, _streamingParams(bob, AMT, start, end_, true));
    }

    function test_Streaming_AtStartTime_ClaimableIsZero() public {
        (bytes32 id, uint64 start,) = _setupStreaming();
        vm.warp(start);
        assertEq(sp.claimableNow(id), 0);
    }

    function test_Streaming_HalfwayThrough_ClaimableIsHalf() public {
        (bytes32 id, uint64 start,) = _setupStreaming();
        vm.warp(start + WINDOW / 2);
        uint128 claimable = sp.claimableNow(id);
        // Allow ±1 for integer truncation
        assertApproxEqAbs(claimable, AMT / 2, 1);
    }

    function test_Streaming_AtEndTime_ClaimableEqualsTotal() public {
        (bytes32 id,, uint64 end_) = _setupStreaming();
        vm.warp(end_);
        assertEq(sp.claimableNow(id), AMT);
    }

    function test_Streaming_AfterEnd_ClaimableStillEqualsTotal() public {
        (bytes32 id,, uint64 end_) = _setupStreaming();
        vm.warp(end_ + 500);
        assertEq(sp.claimableNow(id), AMT);
    }

    function test_Streaming_MultipleSmallClaims_TotalEqualsAmt() public {
        (bytes32 id, uint64 start,) = _setupStreaming();
        uint256 totalClaimed = 0;
        uint256 step = WINDOW / 10;  // 10 claims at 10% intervals

        for (uint256 i = 1; i <= 10; i++) {
            vm.warp(start + step * i);
            uint128 before = sp.claimableNow(id);
            if (before > 0) {
                sp.claim(id);
                totalClaimed += before;
            }
        }
        assertEq(totalClaimed, AMT);
        assertEq(usdc.balanceOf(bob), AMT);
    }

    function test_Streaming_StartGeEnd_Reverts() public {
        uint64 t = uint64(block.timestamp);
        PermitTransferFrom memory p = _buildWitnessPermit(AMT);
        // startTime == endTime is invalid
        ScheduledPayouts.ScheduleParams memory params = _streamingParams(bob, AMT, t + 100, t + 100, false);
        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.InvalidScheduleParams.selector);
        sp.deposit(p, DUMMY_SIG, params);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYROLL (same unlock math as Allowance, different ScheduleType enum)
// ─────────────────────────────────────────────────────────────────────────────
contract ScheduledPayoutsPayrollTest is ScheduledPayoutsTestBase {

    uint128 constant TOTAL      = 10e6;
    uint128 constant PER_PERIOD = 2e6;
    uint64  constant PERIOD     = 1 days;

    function test_Payroll_TypeStoredAsPayroll() public {
        bytes32 id = _depositAs(alice, _payrollParams(bob, TOTAL, PER_PERIOD, PERIOD, false));
        (,, ScheduledPayouts.ScheduleType stype,,,,,,,,,) = sp.schedules(id);
        assertEq(uint8(stype), 3); // enum value 3 = Payroll
    }

    function test_Payroll_UnlockMatchesAllowanceMath() public {
        uint64 start = uint64(block.timestamp);
        bytes32 id   = _depositAs(alice, _payrollParams(bob, TOTAL, PER_PERIOD, PERIOD, false));

        // After 3 periods: 3 * 2 = 6 USDC
        vm.warp(start + 3 * PERIOD);
        assertEq(sp.claimableNow(id), 3 * PER_PERIOD);
    }

    function test_Payroll_CappedAtTotal() public {
        uint64 start = uint64(block.timestamp);
        bytes32 id   = _depositAs(alice, _payrollParams(bob, TOTAL, PER_PERIOD, PERIOD, false));

        vm.warp(start + 10 * PERIOD); // way beyond full vest
        assertEq(sp.claimableNow(id), TOTAL);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL
// ─────────────────────────────────────────────────────────────────────────────
contract ScheduledPayoutsCancelTest is ScheduledPayoutsTestBase {

    uint128 constant AMT    = 100e6;  // 100 USDC
    uint64  constant WINDOW = 1000;

    // Create a revocable streaming schedule and return (id, start, end)
    function _revocableStream()
        internal
        returns (bytes32 id, uint64 start, uint64 end_)
    {
        start = uint64(block.timestamp);
        end_  = start + WINDOW;
        id    = _depositAs(alice, _streamingParams(bob, AMT, start, end_, true));
    }

    // ── happy paths ──────────────────────────────────────────────

    function test_Cancel_BeforeAnyUnlock_RecipientGets0_SenderGetsAll() public {
        (bytes32 id, uint64 start,) = _revocableStream();
        vm.warp(start); // exactly at start, claimable == 0 for Streaming

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        sp.cancel(id);

        assertEq(usdc.balanceOf(bob),   0);       // recipient gets nothing
        assertEq(usdc.balanceOf(alice), aliceBefore + AMT);  // sender gets all back

        // schedule.cancelled = true
        (,,,, bool cancelled,,,,,,, ) = sp.schedules(id);
        assertTrue(cancelled);
    }

    function test_Cancel_At50Percent_RecipientGetsHalf_SenderGetsHalf() public {
        (bytes32 id, uint64 start,) = _revocableStream();
        vm.warp(start + WINDOW / 2);  // 50% streamed

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        sp.cancel(id);

        // Allow ±1 for integer truncation in the streaming formula
        assertApproxEqAbs(usdc.balanceOf(bob),   AMT / 2, 1);
        assertApproxEqAbs(usdc.balanceOf(alice),  aliceBefore + AMT / 2, 1);
    }

    function test_Cancel_AfterFullUnlock_RecipientGets100_SenderGets0() public {
        (bytes32 id,, uint64 end_) = _revocableStream();
        vm.warp(end_);  // 100% streamed but not yet claimed

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        sp.cancel(id);

        assertEq(usdc.balanceOf(bob),   AMT);            // recipient gets all
        assertEq(usdc.balanceOf(alice), aliceBefore);    // sender gets nothing
    }

    function test_Cancel_EmitsCancelled() public {
        (bytes32 id, uint64 start,) = _revocableStream();
        vm.warp(start);  // 0 unlocked

        vm.prank(alice);
        vm.expectEmit(true, true, true, true, address(sp));
        emit ScheduledPayouts.Cancelled(id, alice, bob, 0, AMT);
        sp.cancel(id);
    }

    function test_Cancel_ClaimableNow_ReturnsZeroAfterCancel() public {
        (bytes32 id, uint64 start,) = _revocableStream();
        vm.warp(start + WINDOW / 2);

        vm.prank(alice);
        sp.cancel(id);

        assertEq(sp.claimableNow(id), 0);
    }

    // ── revert paths ─────────────────────────────────────────────

    function test_Cancel_NonRevocable_RevertsNotRevocable() public {
        uint64 start = uint64(block.timestamp);
        uint64 end_  = start + WINDOW;
        bytes32 id   = _depositAs(alice, _streamingParams(bob, AMT, start, end_, false));

        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.NotRevocable.selector);
        sp.cancel(id);
    }

    function test_Cancel_NonRevocable_AdminAlsoReverts() public {
        uint64 start = uint64(block.timestamp);
        uint64 end_  = start + WINDOW;
        bytes32 id   = _depositAs(alice, _streamingParams(bob, AMT, start, end_, false));

        vm.prank(admin);
        vm.expectRevert(ScheduledPayouts.NotRevocable.selector);
        sp.cancel(id);
    }

    function test_Cancel_NonRevocable_CarolAlsoReverts() public {
        uint64 start = uint64(block.timestamp);
        uint64 end_  = start + WINDOW;
        bytes32 id   = _depositAs(alice, _streamingParams(bob, AMT, start, end_, false));

        vm.prank(carol);
        vm.expectRevert(ScheduledPayouts.NotRevocable.selector);
        sp.cancel(id);
    }

    function test_Cancel_NonSender_RevertsNotSender() public {
        (bytes32 id,,) = _revocableStream();

        vm.prank(bob);
        vm.expectRevert(ScheduledPayouts.NotSender.selector);
        sp.cancel(id);
    }

    function test_Cancel_DoubleCancel_RevertsScheduleCancelled() public {
        (bytes32 id, uint64 start,) = _revocableStream();
        vm.warp(start);

        vm.prank(alice);
        sp.cancel(id);

        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.ScheduleCancelled.selector);
        sp.cancel(id);
    }

    function test_Cancel_ClaimAfterCancel_RevertsScheduleCancelled() public {
        (bytes32 id,, uint64 end_) = _revocableStream();
        vm.warp(end_);  // fully unlocked

        vm.prank(alice);
        sp.cancel(id);

        vm.expectRevert(ScheduledPayouts.ScheduleCancelled.selector);
        sp.claim(id);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM
// ─────────────────────────────────────────────────────────────────────────────
contract ScheduledPayoutsClaimTest is ScheduledPayoutsTestBase {

    uint128 constant AMT  = 50e6;
    uint64  constant HOUR = 3600;

    // ── happy paths ──────────────────────────────────────────────

    function test_Claim_AnyoneCanCallClaim_BobGetsTokens() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        bytes32 id  = _depositAs(alice, _payLaterParams(bob, AMT, end_, false));
        vm.warp(end_);

        vm.prank(carol);  // carol triggers claim
        sp.claim(id);

        assertEq(usdc.balanceOf(bob),   AMT);  // bob received
        assertEq(usdc.balanceOf(carol), 0);    // carol got nothing
    }

    function test_Claim_SameBlock_SecondClaimRevertsNothingToClaim() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        bytes32 id  = _depositAs(alice, _payLaterParams(bob, AMT, end_, false));
        vm.warp(end_);

        sp.claim(id);

        vm.expectRevert(ScheduledPayouts.NothingToClaim.selector);
        sp.claim(id);
    }

    function test_Claim_DoubleClaimAfterWarp_EachTakesHalf() public {
        // Use streaming so we can claim at two different checkpoints
        uint64 start = uint64(block.timestamp);
        uint64 end_  = start + 1000;
        bytes32 id   = _depositAs(alice, _streamingParams(bob, AMT, start, end_, false));

        // First half
        vm.warp(start + 500);
        sp.claim(id);
        uint256 firstClaim = usdc.balanceOf(bob);

        // Second half
        vm.warp(end_);
        sp.claim(id);
        uint256 secondClaim = usdc.balanceOf(bob) - firstClaim;

        // Each ~half; allow ±1 for truncation
        assertApproxEqAbs(firstClaim,  AMT / 2, 1);
        assertApproxEqAbs(secondClaim, AMT / 2, 1);
        assertEq(usdc.balanceOf(bob),  AMT);
    }

    // ── revert paths ─────────────────────────────────────────────

    function test_Claim_UnknownSchedule_RevertsScheduleNotFound() public {
        vm.expectRevert(ScheduledPayouts.ScheduleNotFound.selector);
        sp.claim(bytes32(uint256(0xdead)));
    }
}
