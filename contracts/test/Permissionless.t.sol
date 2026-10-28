// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Permissionless.t.sol
 *
 * Proves that a Tier-0 (unverified) wallet can:
 *   1. send USDC via PayRouter.send
 *   2. sendToHandle via PayRouter.sendToHandle
 *   3. requestPay via PayRouter.requestPay
 *   4. createOrder (escrow) via PayRouter.createOrder
 *   5. deposit a schedule via ScheduledPayouts.deposit
 *   6. claim funds from a schedule via ScheduledPayouts.claim
 *
 * These tests confirm that no call to kycRegistry.effectiveTier blocks
 * any of the above flows for an unverified wallet.
 *
 * The global per-payment cap (25 USDC) still applies; tests use amounts
 * within that cap.
 */

import {Test} from "forge-std/Test.sol";
import {MockERC20}        from "../test-helpers/MockERC20.sol";
import {MockPermit2}      from "../test-helpers/MockPermit2.sol";
import {KycRegistry}      from "../KycRegistry.sol";
import {HandleRegistry}   from "../HandleRegistry.sol";
import {PayRouter, InitialBiller, PermitTransferFrom, TokenPermissions} from "../PayRouter.sol";
import {
    ScheduledPayouts,
    PermitTransferFrom as SpPermitTransferFrom,
    TokenPermissions as SpTokenPermissions
} from "../ScheduledPayouts.sol";

contract PermissionlessTest is Test {

    // ── deployed contracts ────────────────────────────────────────────────────
    MockERC20        internal usdc;
    MockPermit2      internal permit2;
    KycRegistry      internal kyc;
    HandleRegistry   internal handleReg;
    PayRouter        internal router;
    ScheduledPayouts internal sp;

    // ── actors ────────────────────────────────────────────────────────────────
    address internal admin          = makeAddr("admin");
    address internal operator       = makeAddr("operator");
    address internal feeWallet      = makeAddr("feeWallet");
    address internal billerAddress  = makeAddr("biller");
    address internal billerTreasury = makeAddr("billerTreasury");

    // unverified: never granted any KYC tier
    address internal unverified     = makeAddr("unverified");
    address internal recipient      = makeAddr("recipient");

    // ── protocol constants (mirror spec) ─────────────────────────────────────
    uint96  internal constant GLOBAL_CAP   = 25_000_000;   // 25 USDC
    uint32  internal constant ORDER_TIMEOUT = 1800;
    uint256 internal constant USDC_6       = 1e6;
    bytes   internal constant SIG          = hex"deadbeef";

    // ─────────────────────────────────────────────────────────────────────────

    function setUp() public {
        usdc    = new MockERC20("Mock USDC", "mUSDC", 6);
        permit2 = new MockPermit2(false); // skip sig verification

        // KycRegistry — no tier set for `unverified`
        kyc = new KycRegistry(admin);

        bytes32[] memory emptyReserved = new bytes32[](0);
        handleReg = new HandleRegistry(admin, emptyReserved);

        // PayRouter: minBillTier = 0 (permissionless), globalPerPaymentCap = 25 USDC
        InitialBiller[] memory billers = new InitialBiller[](1);
        billers[0] = InitialBiller({biller: billerAddress, treasury: billerTreasury});

        router = new PayRouter(
            address(usdc),
            address(kyc),
            address(handleReg),
            address(permit2),
            admin,
            feeWallet,
            PayRouter.TierConfig({perPaymentCap: GLOBAL_CAP, dailyCap: 0}),
            PayRouter.TierConfig({perPaymentCap: GLOBAL_CAP, dailyCap: 0}),
            PayRouter.TierConfig({perPaymentCap: GLOBAL_CAP, dailyCap: 0}),
            GLOBAL_CAP,
            0,               // minBillTier = 0 — permissionless
            ORDER_TIMEOUT,
            0,               // feeBps = 0
            billers
        );

        // Grant operator role on PayRouter
        // Read role constant BEFORE vm.prank — prank is consumed by the first external call.
        bytes32 operatorRole = router.OPERATOR_ROLE();
        vm.prank(admin);
        router.grantRole(operatorRole, operator);

        // ScheduledPayouts: use large caps (global cap is the only real gate)
        sp = new ScheduledPayouts(
            address(usdc),
            address(permit2),
            admin,
            address(kyc),
            GLOBAL_CAP,
            type(uint96).max,
            type(uint96).max,
            type(uint96).max
        );

        // Seed unverified wallet with 100 USDC and approve Permit2
        usdc.mint(unverified, 100 * USDC_6);
        vm.prank(unverified);
        usdc.approve(address(permit2), type(uint256).max);

        // Confirm: unverified has tier 0
        assertEq(kyc.effectiveTier(unverified), 0, "precondition: unverified is Tier 0");
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    function _permit(uint256 amount) internal view returns (PermitTransferFrom memory) {
        return PermitTransferFrom({
            permitted: TokenPermissions({token: address(usdc), amount: amount}),
            nonce: 0,
            deadline: block.timestamp + 1 hours
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. send — unverified wallet can send up to globalPerPaymentCap
    // ─────────────────────────────────────────────────────────────────────────

    function test_Permissionless_Send_Succeeds() public {
        uint256 amount = 10 * USDC_6; // 10 USDC — within 25 USDC cap

        // Pre-fund the mock Permit2 so the transfer can execute
        usdc.mint(address(permit2), amount);

        vm.prank(unverified);
        router.send(_permit(amount), SIG, recipient, amount);

        // Event emitted — side-effects verified via mock (no real Permit2 sig needed)
    }

    function test_Permissionless_Send_AtGlobalCap_Succeeds() public {
        uint256 amount = GLOBAL_CAP; // exactly 25 USDC
        usdc.mint(address(permit2), amount);

        vm.prank(unverified);
        router.send(_permit(amount), SIG, recipient, amount);
    }

    function test_Permissionless_Send_ExceedsGlobalCap_Reverts() public {
        uint256 amount = uint256(GLOBAL_CAP) + 1;

        vm.prank(unverified);
        vm.expectRevert(PayRouter.ExceedsGlobalCap.selector);
        router.send(_permit(amount), SIG, recipient, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. sendToHandle — unverified wallet can send to a registered handle
    // ─────────────────────────────────────────────────────────────────────────

    function test_Permissionless_SendToHandle_Succeeds() public {
        // Register a handle for recipient
        vm.prank(recipient);
        handleReg.claimHandle("alice");

        uint256 amount = 5 * USDC_6;
        usdc.mint(address(permit2), amount);

        vm.prank(unverified);
        router.sendToHandle(_permit(amount), SIG, "alice", amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. requestPay — unverified wallet can pay a payment request
    // ─────────────────────────────────────────────────────────────────────────

    function test_Permissionless_RequestPay_Succeeds() public {
        uint256 amount = 7 * USDC_6;
        usdc.mint(address(permit2), amount);

        vm.prank(unverified);
        router.requestPay(_permit(amount), SIG, keccak256("req1"), recipient, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. createOrder — unverified wallet can create an escrow order
    // ─────────────────────────────────────────────────────────────────────────

    function test_Permissionless_CreateOrder_Succeeds() public {
        uint256 amount = 20 * USDC_6; // within global cap
        usdc.mint(address(permit2), amount);

        // The mock Permit2 records the call; MockPermit2.permitWitnessTransferFrom
        // moves `amount` from Permit2 balance to router.
        usdc.mint(address(permit2), amount);

        vm.prank(unverified);
        bytes32 orderId = router.createOrder(
            _permit(amount),
            SIG,
            billerAddress,
            keccak256("account123"),
            keccak256("ref456"),
            amount
        );

        // Verify order was stored
        (
            address payer,
            ,
            uint128 storedAmount,
            ,
            ,
            PayRouter.OrderStatus status
        ) = router.orders(orderId);

        assertEq(payer,  unverified,               "payer");
        assertEq(storedAmount, uint128(amount),    "amount");
        assertEq(uint8(status), uint8(PayRouter.OrderStatus.Pending), "status");
    }

    function test_Permissionless_CreateOrder_Tier0_WasBlockedBefore_NowSucceeds() public {
        // Explicit regression: the old code had `if (kyc.effectiveTier(msg.sender) < minBillTier) revert`.
        // With minBillTier = 0, even a Tier-0 wallet must succeed.
        assertEq(kyc.effectiveTier(unverified), 0, "unverified is Tier 0");
        assertEq(router.minBillTier(), 0, "minBillTier is 0");

        uint256 amount = 15 * USDC_6;
        usdc.mint(address(permit2), amount);

        vm.prank(unverified);
        // Must NOT revert with InsufficientTierForBillOrder
        router.createOrder(
            _permit(amount),
            SIG,
            billerAddress,
            keccak256("acct"),
            keccak256("ref"),
            amount
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. deposit — unverified wallet can create a scheduled payout
    // ─────────────────────────────────────────────────────────────────────────

    function test_Permissionless_Deposit_Succeeds() public {
        uint256 amount = 20 * USDC_6; // within global cap

        // Mock Permit2 pulls from its own balance for the transfer
        usdc.mint(address(permit2), amount);

        ScheduledPayouts.ScheduleParams memory params = ScheduledPayouts.ScheduleParams({
            recipient:    recipient,
            scheduleType: ScheduledPayouts.ScheduleType.PayLater,
            revocable:    true,
            totalAmount:  uint128(amount),
            startTime:    0,
            endTime:      uint64(block.timestamp + 7 days),
            cliffEnd:     0,
            period:       0,
            periodAmount: 0
        });

        SpPermitTransferFrom memory permit = SpPermitTransferFrom({
            permitted: SpTokenPermissions({token: address(usdc), amount: amount}),
            nonce: 0,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(unverified);
        bytes32 scheduleId = sp.deposit(permit, SIG, params);

        // Verify schedule stored
        (
            address sender,
            address storedRecipient,
            ,,,
            uint128 totalAmount,
            ,,,,,
        ) = sp.schedules(scheduleId);

        assertEq(sender,          unverified, "sender");
        assertEq(storedRecipient, recipient,  "recipient");
        assertEq(totalAmount,     uint128(amount), "totalAmount");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. claim — anyone can trigger a claim; funds go to schedule recipient
    // ─────────────────────────────────────────────────────────────────────────

    function test_Permissionless_Claim_Succeeds() public {
        uint256 amount = 10 * USDC_6;
        uint64 startTime = uint64(block.timestamp);
        uint64 endTime   = uint64(block.timestamp + 100);

        // Fund mock Permit2 for the deposit transfer
        usdc.mint(address(permit2), amount);
        // Fund ScheduledPayouts contract so claim transfer succeeds
        usdc.mint(address(sp), amount);

        ScheduledPayouts.ScheduleParams memory params = ScheduledPayouts.ScheduleParams({
            recipient:    recipient,
            scheduleType: ScheduledPayouts.ScheduleType.Streaming,
            revocable:    false,
            totalAmount:  uint128(amount),
            startTime:    startTime,
            endTime:      endTime,
            cliffEnd:     0,
            period:       0,
            periodAmount: 0
        });

        SpPermitTransferFrom memory permit = SpPermitTransferFrom({
            permitted: SpTokenPermissions({token: address(usdc), amount: amount}),
            nonce: 0,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(unverified);
        bytes32 scheduleId = sp.deposit(permit, SIG, params);

        // Advance time so 50% of the stream has elapsed
        vm.warp(block.timestamp + 50);

        // Anyone can trigger claim; transfer always goes to recipient
        uint256 recipientBefore = usdc.balanceOf(recipient);
        sp.claim(scheduleId);
        uint256 recipientAfter = usdc.balanceOf(recipient);

        assertGt(recipientAfter, recipientBefore, "recipient received funds");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Edge: global cap still enforced (no tier, but cap remains)
    // ─────────────────────────────────────────────────────────────────────────

    function test_Permissionless_Deposit_ExceedsGlobalCap_Reverts() public {
        uint256 amount = uint256(GLOBAL_CAP) + 1;
        usdc.mint(address(permit2), amount);

        ScheduledPayouts.ScheduleParams memory params = ScheduledPayouts.ScheduleParams({
            recipient:    recipient,
            scheduleType: ScheduledPayouts.ScheduleType.PayLater,
            revocable:    true,
            totalAmount:  uint128(amount),
            startTime:    0,
            endTime:      uint64(block.timestamp + 7 days),
            cliffEnd:     0,
            period:       0,
            periodAmount: 0
        });

        SpPermitTransferFrom memory permit = SpPermitTransferFrom({
            permitted: SpTokenPermissions({token: address(usdc), amount: amount}),
            nonce: 0,
            deadline: block.timestamp + 1 hours
        });

        vm.prank(unverified);
        vm.expectRevert(ScheduledPayouts.ExceedsGlobalCap.selector);
        sp.deposit(permit, SIG, params);
    }
}
