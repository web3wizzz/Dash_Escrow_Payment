// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockERC20}   from "../test-helpers/MockERC20.sol";
import {MockPermit2} from "../test-helpers/MockPermit2.sol";
import {KycRegistry} from "../KycRegistry.sol";
import {
    ScheduledPayouts,
    PermitTransferFrom,
    TokenPermissions
} from "../ScheduledPayouts.sol";

abstract contract ScheduledPayoutsTestBase is Test {

    // ── deployed contracts ────────────────────────────────────────
    MockERC20          internal usdc;
    MockPermit2        internal permit2;
    KycRegistry        internal kyc;
    ScheduledPayouts   internal sp;

    // ── actors ────────────────────────────────────────────────────
    address internal admin = makeAddr("admin");
    address internal alice = makeAddr("alice");   // sender (Tier 2 in tests)
    address internal bob   = makeAddr("bob");     // recipient
    address internal carol = makeAddr("carol");   // third party

    // ── constants ─────────────────────────────────────────────────
    uint256 internal constant USDC_6   = 1e6;          // 1 USDC
    uint128 internal constant SEED     = 10_000e6;     // 10 000 USDC

    // Tier caps — set very large so test amounts (up to SEED) never hit them.
    // Tier enforcement correctness is separately tested in ScheduledPayouts.Tier tests.
    uint96 internal constant GLOBAL_CAP = type(uint96).max;
    uint96 internal constant T0_CAP     = type(uint96).max;
    uint96 internal constant T1_CAP     = type(uint96).max;
    uint96 internal constant T2_CAP     = type(uint96).max;

    bytes   internal constant DUMMY_SIG = hex"deadbeef";

    // ── ScheduleType enum values ──────────────────────────────────
    ScheduledPayouts.ScheduleType internal constant T_PAYLATER   = ScheduledPayouts.ScheduleType.PayLater;
    ScheduledPayouts.ScheduleType internal constant T_ALLOWANCE  = ScheduledPayouts.ScheduleType.Allowance;
    ScheduledPayouts.ScheduleType internal constant T_VESTING    = ScheduledPayouts.ScheduleType.Vesting;
    ScheduledPayouts.ScheduleType internal constant T_PAYROLL    = ScheduledPayouts.ScheduleType.Payroll;
    ScheduledPayouts.ScheduleType internal constant T_STREAMING  = ScheduledPayouts.ScheduleType.Streaming;

    // ─────────────────────────────────────────────────────────────
    // setUp — runs before every test
    // ─────────────────────────────────────────────────────────────
    function setUp() public virtual {
        // 1. Mock USDC (6 decimals)
        usdc = new MockERC20("Mock USDC", "mUSDC", 6);

        // 2. Mock Permit2 (enforceSenderCheck = false for normal flows)
        permit2 = new MockPermit2(false);

        // 3. KycRegistry — grant alice Tier 2 so large test deposits pass tier checks
        kyc = new KycRegistry(admin);
        bytes32 verifierRole = kyc.VERIFIER_ROLE();
        vm.prank(admin);
        kyc.grantRole(verifierRole, admin);
        vm.prank(admin);
        kyc.setTier(alice, 2, type(uint64).max);

        // 4. ScheduledPayouts — pass max caps so existing tests aren't disrupted
        sp = new ScheduledPayouts(
            address(usdc),
            address(permit2),
            admin,
            address(kyc),
            GLOBAL_CAP,
            T0_CAP,
            T1_CAP,
            T2_CAP
        );

        // 5. Seed alice and approve Permit2
        usdc.mint(alice, SEED);
        vm.prank(alice);
        usdc.approve(address(permit2), type(uint256).max);
    }

    // ─────────────────────────────────────────────────────────────
    // scheduleId helper
    // ─────────────────────────────────────────────────────────────
    function _scheduleId(
        address sender,
        address recipient,
        uint256 nonce
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(sender, recipient, nonce));
    }

    // ─────────────────────────────────────────────────────────────
    // PermitTransferFrom builder for deposit (canonical Permit2 — no witness field in struct)
    // The contract computes the witness hash and passes it as a separate bytes32 to Permit2.
    // ─────────────────────────────────────────────────────────────
    function _buildWitnessPermit(uint256 amount)
        internal
        view
        returns (PermitTransferFrom memory)
    {
        return PermitTransferFrom({
            permitted: TokenPermissions({token: address(usdc), amount: amount}),
            nonce:     0,
            deadline:  block.timestamp + 1 hours
        });
    }

    // ─────────────────────────────────────────────────────────────
    // ScheduleParams builders
    // ─────────────────────────────────────────────────────────────

    function _payLaterParams(
        address recipient,
        uint128 amount,
        uint64  endTime,
        bool    revocable
    ) internal pure returns (ScheduledPayouts.ScheduleParams memory) {
        return ScheduledPayouts.ScheduleParams({
            recipient:    recipient,
            scheduleType: ScheduledPayouts.ScheduleType.PayLater,
            revocable:    revocable,
            totalAmount:  amount,
            startTime:    0,
            endTime:      endTime,
            cliffEnd:     0,
            period:       0,
            periodAmount: 0
        });
    }

    function _allowanceParams(
        address recipient,
        uint128 total,
        uint128 perPeriod,
        uint64  period,
        bool    revocable
    ) internal view returns (ScheduledPayouts.ScheduleParams memory) {
        return ScheduledPayouts.ScheduleParams({
            recipient:    recipient,
            scheduleType: ScheduledPayouts.ScheduleType.Allowance,
            revocable:    revocable,
            totalAmount:  total,
            startTime:    uint64(block.timestamp),
            endTime:      uint64(block.timestamp) + uint64(total / perPeriod) * period + period,
            cliffEnd:     0,
            period:       period,
            periodAmount: perPeriod
        });
    }

    function _payrollParams(
        address recipient,
        uint128 total,
        uint128 perPeriod,
        uint64  period,
        bool    revocable
    ) internal view returns (ScheduledPayouts.ScheduleParams memory) {
        return ScheduledPayouts.ScheduleParams({
            recipient:    recipient,
            scheduleType: ScheduledPayouts.ScheduleType.Payroll,
            revocable:    revocable,
            totalAmount:  total,
            startTime:    uint64(block.timestamp),
            endTime:      uint64(block.timestamp) + uint64(total / perPeriod) * period + period,
            cliffEnd:     0,
            period:       period,
            periodAmount: perPeriod
        });
    }

    function _vestingParams(
        address recipient,
        uint128 amount,
        uint64  start,
        uint64  cliff,
        uint64  end_,
        bool    revocable
    ) internal pure returns (ScheduledPayouts.ScheduleParams memory) {
        return ScheduledPayouts.ScheduleParams({
            recipient:    recipient,
            scheduleType: ScheduledPayouts.ScheduleType.Vesting,
            revocable:    revocable,
            totalAmount:  amount,
            startTime:    start,
            endTime:      end_,
            cliffEnd:     cliff,
            period:       0,
            periodAmount: 0
        });
    }

    function _streamingParams(
        address recipient,
        uint128 amount,
        uint64  start,
        uint64  end_,
        bool    revocable
    ) internal pure returns (ScheduledPayouts.ScheduleParams memory) {
        return ScheduledPayouts.ScheduleParams({
            recipient:    recipient,
            scheduleType: ScheduledPayouts.ScheduleType.Streaming,
            revocable:    revocable,
            totalAmount:  amount,
            startTime:    start,
            endTime:      end_,
            cliffEnd:     0,
            period:       0,
            periodAmount: 0
        });
    }

    // ─────────────────────────────────────────────────────────────
    // Convenience: deposit from alice and return the scheduleId
    // ─────────────────────────────────────────────────────────────
    function _depositAs(
        address sender,
        ScheduledPayouts.ScheduleParams memory params
    ) internal returns (bytes32 id) {
        PermitTransferFrom memory p = _buildWitnessPermit(params.totalAmount);
        vm.prank(sender);
        id = sp.deposit(p, DUMMY_SIG, params);
    }
}
