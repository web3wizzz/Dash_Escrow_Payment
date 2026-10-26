// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ScheduledPayoutsTestBase} from "./ScheduledPayouts.Base.t.sol";
import {ScheduledPayouts, PermitTransferFrom, TokenPermissions}
    from "../ScheduledPayouts.sol";
import {Pausable}    from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

// ─────────────────────────────────────────────────────────────────────────────
// DEPLOY & INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────
contract ScheduledPayoutsDeployTest is ScheduledPayoutsTestBase {

    function test_Deploy_SetsUsdcAndPermit2() public view {
        assertEq(address(sp.usdc()),   address(usdc));
        assertEq(address(sp.permit2()), address(permit2));
    }

    function test_Deploy_AdminHasDefaultAdminRole() public view {
        assertTrue(sp.hasRole(sp.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_Deploy_AdminHasPauserRole() public view {
        assertTrue(sp.hasRole(sp.PAUSER_ROLE(), admin));
    }

    function test_Deploy_ZeroUsdc_Reverts() public {
        vm.expectRevert(ScheduledPayouts.ZeroAddress.selector);
        new ScheduledPayouts(address(0), address(permit2), admin, address(kyc), GLOBAL_CAP, T0_CAP, T1_CAP, T2_CAP);
    }

    function test_Deploy_ZeroPermit2_Reverts() public {
        vm.expectRevert(ScheduledPayouts.ZeroAddress.selector);
        new ScheduledPayouts(address(usdc), address(0), admin, address(kyc), GLOBAL_CAP, T0_CAP, T1_CAP, T2_CAP);
    }

    function test_Deploy_ZeroAdmin_Reverts() public {
        vm.expectRevert(ScheduledPayouts.ZeroAddress.selector);
        new ScheduledPayouts(address(usdc), address(permit2), address(0), address(kyc), GLOBAL_CAP, T0_CAP, T1_CAP, T2_CAP);
    }

    function test_Deploy_InitialNonce_IsZero() public view {
        assertEq(sp.nextDepositNonce(alice), 0);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAY LATER
// ─────────────────────────────────────────────────────────────────────────────
contract ScheduledPayoutsPayLaterTest is ScheduledPayoutsTestBase {

    uint128 constant AMT  = 5e6;    // 5 USDC
    uint64  constant HOUR = 3600;

    // ── happy path ───────────────────────────────────────────────

    function test_PayLater_HappyPath_ScheduleIdDerivation() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        bytes32 expected = _scheduleId(alice, bob, 0);
        bytes32 id = _depositAs(alice, _payLaterParams(bob, AMT, end_, true));
        assertEq(id, expected);
    }

    function test_PayLater_HappyPath_ScheduleStoredCorrectly() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        bytes32 id  = _depositAs(alice, _payLaterParams(bob, AMT, end_, true));

        (
            address sender,
            address recipient,
            ScheduledPayouts.ScheduleType stype,
            bool revocable,
            bool cancelled,
            uint128 totalAmount,
            uint128 claimed,
            ,
            uint64 endTime,
            ,
            ,

        ) = sp.schedules(id);

        assertEq(sender,      alice);
        assertEq(recipient,   bob);
        assertEq(uint8(stype), uint8(T_PAYLATER));
        assertTrue(revocable);
        assertFalse(cancelled);
        assertEq(totalAmount, AMT);
        assertEq(claimed,     0);
        assertEq(endTime,     end_);
    }

    function test_PayLater_HappyPath_EmitsScheduleCreated() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        bytes32 expected = _scheduleId(alice, bob, 0);

        PermitTransferFrom memory p = _buildWitnessPermit(AMT);
        ScheduledPayouts.ScheduleParams memory params = _payLaterParams(bob, AMT, end_, true);

        vm.prank(alice);
        vm.expectEmit(true, true, true, true, address(sp));
        emit ScheduledPayouts.ScheduleCreated(expected, alice, bob, T_PAYLATER, AMT);
        sp.deposit(p, DUMMY_SIG, params);
    }

    function test_PayLater_HappyPath_UsdcTransferredIn() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        _depositAs(alice, _payLaterParams(bob, AMT, end_, true));
        assertEq(usdc.balanceOf(address(sp)), AMT);
        assertEq(usdc.balanceOf(alice),       SEED - AMT);
    }

    function test_PayLater_BeforeEndTime_ClaimableIsZero() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        bytes32 id  = _depositAs(alice, _payLaterParams(bob, AMT, end_, true));

        vm.warp(block.timestamp + HOUR - 1);
        assertEq(sp.claimableNow(id), 0);
    }

    function test_PayLater_AtEndTime_ClaimableEqualsTotal() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        bytes32 id  = _depositAs(alice, _payLaterParams(bob, AMT, end_, true));

        vm.warp(end_);
        assertEq(sp.claimableNow(id), AMT);
    }

    function test_PayLater_HappyPath_ClaimAfterEnd_BobReceives() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        bytes32 id  = _depositAs(alice, _payLaterParams(bob, AMT, end_, true));

        vm.warp(end_);
        carol.call(""); // silence unused var warning — just verify bob balance
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.prank(carol);  // anyone can call claim
        sp.claim(id);

        assertEq(usdc.balanceOf(bob),       bobBefore + AMT);
        assertEq(usdc.balanceOf(carol),     0);          // carol gets nothing
        assertEq(usdc.balanceOf(address(sp)), 0);
    }

    function test_PayLater_HappyPath_EmitsClaimed() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        bytes32 id  = _depositAs(alice, _payLaterParams(bob, AMT, end_, true));

        vm.warp(end_);
        vm.expectEmit(true, true, false, true, address(sp));
        emit ScheduledPayouts.Claimed(id, bob, AMT, AMT);
        sp.claim(id);
    }

    function test_PayLater_ClaimBeforeEnd_RevertsNothingToClaim() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        bytes32 id  = _depositAs(alice, _payLaterParams(bob, AMT, end_, true));

        vm.warp(end_ - 1);
        vm.expectRevert(ScheduledPayouts.NothingToClaim.selector);
        sp.claim(id);
    }

    function test_PayLater_NonceIncrements() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        _depositAs(alice, _payLaterParams(bob,   AMT, end_, true));  // nonce=0
        _depositAs(alice, _payLaterParams(carol, AMT, end_, true));  // nonce=1

        bytes32 id1 = _scheduleId(alice, bob,   0);
        bytes32 id2 = _scheduleId(alice, carol, 1);

        // both schedules exist (sender is non-zero)
        (address s1,,,,,,,,,,,) = sp.schedules(id1);
        (address s2,,,,,,,,,,,) = sp.schedules(id2);
        assertEq(s1, alice);
        assertEq(s2, alice);
        assertEq(sp.nextDepositNonce(alice), 2);
    }

    // ── revert paths ─────────────────────────────────────────────

    function test_PayLater_ZeroRecipient_Reverts() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        PermitTransferFrom memory p = _buildWitnessPermit(AMT);
        ScheduledPayouts.ScheduleParams memory params = _payLaterParams(address(0), AMT, end_, false);
        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.ZeroAddress.selector);
        sp.deposit(p, DUMMY_SIG, params);
    }

    function test_PayLater_ZeroAmount_Reverts() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        PermitTransferFrom memory p = _buildWitnessPermit(0);
        ScheduledPayouts.ScheduleParams memory params = _payLaterParams(bob, 0, end_, false);
        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.ZeroAmount.selector);
        sp.deposit(p, DUMMY_SIG, params);
    }

    function test_PayLater_EndTimeInPast_Reverts() public {
        uint64 end_ = uint64(block.timestamp) - 1;
        PermitTransferFrom memory p = _buildWitnessPermit(AMT);
        ScheduledPayouts.ScheduleParams memory params = _payLaterParams(bob, AMT, end_, false);
        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.InvalidScheduleParams.selector);
        sp.deposit(p, DUMMY_SIG, params);
    }

    function test_PayLater_AmountMismatch_Reverts() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        // permit says 10 USDC, params says 5
        PermitTransferFrom memory p = _buildWitnessPermit(10e6);
        ScheduledPayouts.ScheduleParams memory params = _payLaterParams(bob, AMT, end_, false);
        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.InvalidScheduleParams.selector);
        sp.deposit(p, DUMMY_SIG, params);
    }

    function test_PayLater_WrongToken_Reverts() public {
        uint64 end_ = uint64(block.timestamp) + HOUR;
        PermitTransferFrom memory p = PermitTransferFrom({
            permitted: TokenPermissions({token: address(0xdead), amount: AMT}),
            nonce:     0,
            deadline:  block.timestamp + 1 hours
        });
        ScheduledPayouts.ScheduleParams memory params = _payLaterParams(bob, AMT, end_, false);
        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.InvalidScheduleParams.selector);
        sp.deposit(p, DUMMY_SIG, params);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ALLOWANCE
// ─────────────────────────────────────────────────────────────────────────────
contract ScheduledPayoutsAllowanceTest is ScheduledPayoutsTestBase {

    uint128 constant TOTAL      = 10e6;   // 10 USDC total
    uint128 constant PER_PERIOD = 2e6;    //  2 USDC per period
    uint64  constant PERIOD     = 1 days;

    // Returns (id, startTime)
    function _setupAllowance() internal returns (bytes32 id, uint64 start) {
        start = uint64(block.timestamp);
        id    = _depositAs(alice, _allowanceParams(bob, TOTAL, PER_PERIOD, PERIOD, true));
    }

    function test_Allowance_HappyPath_ScheduleType() public {
        (bytes32 id,) = _setupAllowance();
        (,, ScheduledPayouts.ScheduleType stype,,,,,,,,,) = sp.schedules(id);
        assertEq(uint8(stype), uint8(T_ALLOWANCE));
    }

    function test_Allowance_After1Period_Claimable2USDC() public {
        (bytes32 id, uint64 start) = _setupAllowance();
        vm.warp(start + PERIOD);
        assertEq(sp.claimableNow(id), PER_PERIOD);
    }

    function test_Allowance_After5Periods_ClaimableCappedAtTotal() public {
        (bytes32 id, uint64 start) = _setupAllowance();
        vm.warp(start + 5 * PERIOD);
        assertEq(sp.claimableNow(id), TOTAL);
    }

    function test_Allowance_After6Periods_DoesNotExceedTotal() public {
        (bytes32 id, uint64 start) = _setupAllowance();
        vm.warp(start + 6 * PERIOD);
        assertEq(sp.claimableNow(id), TOTAL);
    }

    function test_Allowance_PartialClaimThenMore_OnlyNewPeriodUnlocked() public {
        (bytes32 id, uint64 start) = _setupAllowance();

        // Claim period 1 allocation
        vm.warp(start + PERIOD);
        assertEq(sp.claimableNow(id), PER_PERIOD);
        sp.claim(id);

        // After period 2 — only 1 new period worth should be claimable
        vm.warp(start + 2 * PERIOD);
        assertEq(sp.claimableNow(id), PER_PERIOD);

        sp.claim(id);
        assertEq(usdc.balanceOf(bob), PER_PERIOD * 2);
    }

    function test_Allowance_ZeroPeriod_Reverts() public {
        PermitTransferFrom memory p = _buildWitnessPermit(TOTAL);
        ScheduledPayouts.ScheduleParams memory params = ScheduledPayouts.ScheduleParams({
            recipient:    bob,
            scheduleType: T_ALLOWANCE,
            revocable:    false,
            totalAmount:  TOTAL,
            startTime:    uint64(block.timestamp),
            endTime:      uint64(block.timestamp) + 10 days,
            cliffEnd:     0,
            period:       0,   // <-- invalid
            periodAmount: PER_PERIOD
        });
        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.InvalidScheduleParams.selector);
        sp.deposit(p, DUMMY_SIG, params);
    }

    function test_Allowance_ZeroPeriodAmount_Reverts() public {
        PermitTransferFrom memory p = _buildWitnessPermit(TOTAL);
        ScheduledPayouts.ScheduleParams memory params = ScheduledPayouts.ScheduleParams({
            recipient:    bob,
            scheduleType: T_ALLOWANCE,
            revocable:    false,
            totalAmount:  TOTAL,
            startTime:    uint64(block.timestamp),
            endTime:      uint64(block.timestamp) + 10 days,
            cliffEnd:     0,
            period:       PERIOD,
            periodAmount: 0   // <-- invalid
        });
        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.InvalidScheduleParams.selector);
        sp.deposit(p, DUMMY_SIG, params);
    }

    function test_Allowance_PeriodAmountExceedsTotal_Reverts() public {
        PermitTransferFrom memory p = _buildWitnessPermit(TOTAL);
        ScheduledPayouts.ScheduleParams memory params = ScheduledPayouts.ScheduleParams({
            recipient:    bob,
            scheduleType: T_ALLOWANCE,
            revocable:    false,
            totalAmount:  TOTAL,
            startTime:    uint64(block.timestamp),
            endTime:      uint64(block.timestamp) + 10 days,
            cliffEnd:     0,
            period:       PERIOD,
            periodAmount: TOTAL + 1   // <-- exceeds total
        });
        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.InvalidScheduleParams.selector);
        sp.deposit(p, DUMMY_SIG, params);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// VESTING
// ─────────────────────────────────────────────────────────────────────────────
contract ScheduledPayoutsVestingTest is ScheduledPayoutsTestBase {

    uint128 constant AMT    = 120e6;   // 120 USDC
    uint64  constant WINDOW = 120;     // 120-second vest window (easy math)

    // start=now, cliff=now+30s, end=now+120s
    function _setupVesting()
        internal
        returns (bytes32 id, uint64 start, uint64 cliff, uint64 end_)
    {
        start = uint64(block.timestamp);
        cliff = start + 30;
        end_  = start + WINDOW;
        id    = _depositAs(alice, _vestingParams(bob, AMT, start, cliff, end_, true));
    }

    function test_Vesting_BeforeCliff_ClaimableIsZero() public {
        (bytes32 id,, uint64 cliff,) = _setupVesting();
        vm.warp(cliff - 1);
        assertEq(sp.claimableNow(id), 0);
    }

    function test_Vesting_AtCliff_ClaimableIsPositive() public {
        (bytes32 id, uint64 start, uint64 cliff,) = _setupVesting();
        vm.warp(cliff);
        // linear from start: at cliff (t=30, window=120) => 30/120 * 120 = 30 USDC
        uint128 expected = uint128((uint256(AMT) * (cliff - start)) / WINDOW);
        assertEq(sp.claimableNow(id), expected);
    }

    function test_Vesting_AtEnd_ClaimableEqualsTotal() public {
        (bytes32 id,,, uint64 end_) = _setupVesting();
        vm.warp(end_);
        assertEq(sp.claimableNow(id), AMT);
    }

    function test_Vesting_AtEnd_ClaimAll() public {
        (bytes32 id,,, uint64 end_) = _setupVesting();
        vm.warp(end_);
        sp.claim(id);
        (,,,,, , uint128 claimed,,,,,) = sp.schedules(id);
        assertEq(claimed, AMT);
        assertEq(usdc.balanceOf(bob), AMT);
    }

    function test_Vesting_AfterEnd_ClaimableDoesNotExceedTotal() public {
        (bytes32 id,,, uint64 end_) = _setupVesting();
        vm.warp(end_ + 1000);
        assertEq(sp.claimableNow(id), AMT);
    }

    function test_Vesting_ImmediateCliff_AtStart_ClaimableIsZero() public {
        // cliffEnd == startTime; at exactly startTime the linear calc gives 0
        uint64 start = uint64(block.timestamp);
        uint64 cliff = start;          // immediate cliff
        uint64 end_  = start + WINDOW;
        bytes32 id = _depositAs(alice, _vestingParams(bob, AMT, start, cliff, end_, false));

        vm.warp(start);
        // t == startTime: (totalAmount * (t - startTime)) / window = 0
        assertEq(sp.claimableNow(id), 0);
    }

    function test_Vesting_StartGeEnd_Reverts() public {
        uint64 t = uint64(block.timestamp);
        PermitTransferFrom memory p = _buildWitnessPermit(AMT);
        ScheduledPayouts.ScheduleParams memory params = _vestingParams(bob, AMT, t + 10, t, t + 10, false); // start >= end
        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.InvalidScheduleParams.selector);
        sp.deposit(p, DUMMY_SIG, params);
    }

    function test_Vesting_CliffBeforeStart_Reverts() public {
        uint64 t = uint64(block.timestamp);
        PermitTransferFrom memory p = _buildWitnessPermit(AMT);
        // cliffEnd < startTime
        ScheduledPayouts.ScheduleParams memory params = _vestingParams(bob, AMT, t + 10, t + 5, t + 100, false);
        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.InvalidScheduleParams.selector);
        sp.deposit(p, DUMMY_SIG, params);
    }

    function test_Vesting_CliffAfterEnd_Reverts() public {
        uint64 t = uint64(block.timestamp);
        PermitTransferFrom memory p = _buildWitnessPermit(AMT);
        // cliffEnd > endTime
        ScheduledPayouts.ScheduleParams memory params = _vestingParams(bob, AMT, t, t + 200, t + 100, false);
        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.InvalidScheduleParams.selector);
        sp.deposit(p, DUMMY_SIG, params);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// WITHDRAW (pendingWithdrawals)
// ─────────────────────────────────────────────────────────────────────────────
contract ScheduledPayoutsWithdrawTest is ScheduledPayoutsTestBase {

    function test_Withdraw_ZeroBalance_RevertsNothingToClaim() public {
        vm.prank(bob);
        vm.expectRevert(ScheduledPayouts.NothingToClaim.selector);
        sp.withdraw();
    }

    function test_Withdraw_NormalFlow_PendingIsZeroAfterClaim() public {
        // In normal flow (MockERC20 succeeds), _push succeeds, no pending balance
        uint64 end_ = uint64(block.timestamp) + 1;
        bytes32 id  = _depositAs(alice, _payLaterParams(bob, 5e6, end_, false));
        vm.warp(end_);
        sp.claim(id);
        // pendingWithdrawals should be 0 — direct transfer succeeded
        assertEq(sp.pendingWithdrawals(bob), 0);
        assertEq(usdc.balanceOf(bob), 5e6);
    }

    function test_Withdraw_EmitsWithdrawnEvent() public {
        // To test Withdrawn event we need a pendingWithdrawal.
        // We use vm.store to set it directly (no reverting mock needed).
        // pendingWithdrawals is at slot 2 in the mapping (slot = keccak256(key . 2))
        // We seed a pending balance via storage manipulation.
        uint128 amount = 7e6;
        usdc.mint(address(sp), amount);  // contract must hold the funds

        // Write pendingWithdrawals[bob] = amount  (pendingWithdrawals is at slot 3)
        bytes32 slot = keccak256(abi.encode(bob, uint256(3)));
        vm.store(address(sp), slot, bytes32(uint256(amount)));

        assertEq(sp.pendingWithdrawals(bob), amount);

        vm.prank(bob);
        vm.expectEmit(true, false, false, true, address(sp));
        emit ScheduledPayouts.Withdrawn(bob, amount);
        sp.withdraw();

        assertEq(usdc.balanceOf(bob),       amount);
        assertEq(sp.pendingWithdrawals(bob), 0);
    }

    // Note: full blocklist simulation (where _push fails and pendingWithdrawals
    // is populated via the claim/cancel path) requires a reverting USDC mock.
    // That is a post-deploy integration concern and is not covered in this hermetic
    // unit-test file.
}

// ─────────────────────────────────────────────────────────────────────────────
// T-02 / T-03: Tier cap enforcement on deposit
// ─────────────────────────────────────────────────────────────────────────────
contract ScheduledPayoutsTierTest is ScheduledPayoutsTestBase {

    uint128 constant GLOBAL_CAP_REAL = 25_000_000; // 25 USDC (6 decimals)
    uint96  constant T0_CAP_REAL     = 5_000_000;  // 5 USDC — Tier 0
    uint96  constant T1_CAP_REAL     = 100_000_000; // 100 USDC — Tier 1
    uint96  constant T2_CAP_REAL     = 20_000_000_000; // 20,000 USDC — Tier 2

    ScheduledPayouts internal spTier; // separate instance with real caps
    address internal eve = makeAddr("eve"); // Tier 0 user (no KYC)

    function setUp() public override {
        super.setUp();

        // Deploy a second ScheduledPayouts with realistic caps
        spTier = new ScheduledPayouts(
            address(usdc),
            address(permit2),
            admin,
            address(kyc),
            uint96(GLOBAL_CAP_REAL),
            T0_CAP_REAL,
            T1_CAP_REAL,
            T2_CAP_REAL
        );

        // Fund eve (Tier 0 — no KYC set)
        usdc.mint(eve, SEED);
        vm.prank(eve);
        usdc.approve(address(permit2), type(uint256).max);
    }

    /// T-02: Tier-0 user depositing above the per-payment cap reverts.
    function test_Tier0_Deposit_AboveCap_Reverts() public {
        uint128 tooMuch = uint128(T0_CAP_REAL) + 1;
        uint64 end_ = uint64(block.timestamp) + 3600;
        ScheduledPayouts.ScheduleParams memory params = _payLaterParams(bob, tooMuch, end_, false);
        PermitTransferFrom memory p = _buildWitnessPermit(tooMuch);

        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(ScheduledPayouts.ExceedsTierPerPaymentCap.selector, uint8(0)));
        spTier.deposit(p, DUMMY_SIG, params);
    }

    /// T-02 (passing): Tier-1 user depositing within per-payment cap AND global cap succeeds.
    function test_Tier1_Deposit_WithinCap_Succeeds() public {
        // Grant alice Tier 1 on spTier's kyc (same kyc instance)
        vm.prank(admin);
        kyc.setTier(alice, 1, type(uint64).max);

        // Use global cap amount (25 USDC) — both global cap and Tier-1 cap (100 USDC) allow this.
        uint128 amt = uint128(GLOBAL_CAP_REAL);
        uint64 end_ = uint64(block.timestamp) + 3600;
        ScheduledPayouts.ScheduleParams memory params = _payLaterParams(bob, amt, end_, false);
        PermitTransferFrom memory p = _buildWitnessPermit(amt);

        vm.prank(alice);
        spTier.deposit(p, DUMMY_SIG, params); // must not revert
    }

    /// T-03: Any user depositing above the global cap reverts, regardless of tier.
    function test_GlobalCap_Deposit_AboveCap_Reverts() public {
        // Grant alice Tier 2 so tier check passes, but global cap is 25 USDC
        vm.prank(admin);
        kyc.setTier(alice, 2, type(uint64).max);

        uint128 tooMuch = uint128(GLOBAL_CAP_REAL) + 1;
        uint64 end_ = uint64(block.timestamp) + 3600;
        ScheduledPayouts.ScheduleParams memory params = _payLaterParams(bob, tooMuch, end_, false);
        PermitTransferFrom memory p = _buildWitnessPermit(tooMuch);

        vm.prank(alice);
        vm.expectRevert(ScheduledPayouts.ExceedsGlobalCap.selector);
        spTier.deposit(p, DUMMY_SIG, params);
    }
}
