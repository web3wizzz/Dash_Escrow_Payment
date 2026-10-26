// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ScheduledPayoutsTestBase} from "./ScheduledPayouts.Base.t.sol";
import {ScheduledPayouts, PermitTransferFrom, TokenPermissions}
    from "../ScheduledPayouts.sol";
import {MockPermit2} from "../test-helpers/MockPermit2.sol";
import {Pausable}    from "@openzeppelin/contracts/utils/Pausable.sol";

// ─────────────────────────────────────────────────────────────────────────────
// PERMIT2 SECURITY
// ─────────────────────────────────────────────────────────────────────────────
contract ScheduledPayoutsPermitSecurityTest is ScheduledPayoutsTestBase {

    // ── relay-attack test ─────────────────────────────────────────
    // Deploy a strict MockPermit2 (enforceSenderCheck=true) and a second
    // ScheduledPayouts instance that uses it. Carol calls deposit() but the
    // permit's owner is alice — strict Permit2 rejects owner != msg.sender.

    function test_Permit2_RelayAttack_Reverts() public {
        // 1. Strict Permit2
        MockPermit2 strictPermit2 = new MockPermit2(true);
        ScheduledPayouts sp2 = new ScheduledPayouts(
            address(usdc), address(strictPermit2), admin,
            address(kyc), GLOBAL_CAP, T0_CAP, T1_CAP, T2_CAP
        );

        // 2. Alice approves the strict Permit2
        vm.prank(alice);
        usdc.approve(address(strictPermit2), type(uint256).max);

        // 3. Build permit — owner is alice (signed by alice off-chain)
        uint128 amt  = 5e6;
        uint64  end_ = uint64(block.timestamp) + 3600;
        PermitTransferFrom memory p = _buildWitnessPermit(amt);
        ScheduledPayouts.ScheduleParams memory params = _payLaterParams(bob, amt, end_, false);

        // 4. Carol attempts to relay alice's permit → strict Permit2 rejects
        //    because owner (alice) != msg.sender (carol)
        vm.prank(carol);
        vm.expectRevert(bytes("MockPermit2: owner != msg.sender"));
        sp2.deposit(p, DUMMY_SIG, params);
    }

    // ── witness-mismatch observation test ─────────────────────────
    // The contract writes the witness into the permit before calling Permit2.
    // If the params passed to deposit() differ from what was signed, the witness
    // the contract computes will differ from the one the signer expected.
    // MockPermit2 (non-strict) records lastWitnessValue; we check that two
    // deposits with different params produce different witness values.
    // In production, real Permit2 rejects a mismatched witness via EIP-712 sig
    // verification — the contract cannot forge a valid sig for a wrong witness.

    function test_Permit2_DifferentParams_ProduceDifferentWitnesses() public {
        uint128 amt  = 5e6;
        uint64  end_ = uint64(block.timestamp) + 3600;

        // Deposit 1
        _depositAs(alice, _payLaterParams(bob, amt, end_, false));
        bytes32 witness1 = permit2.lastWitnessValue();

        // Deposit 2 with different endTime (simulates tampered param)
        uint64 end2 = end_ + 60;
        // Mint extra for alice's second deposit
        usdc.mint(alice, amt);
        _depositAs(alice, _payLaterParams(bob, amt, end2, false));
        bytes32 witness2 = permit2.lastWitnessValue();

        // Witnesses must differ — a tampered param changes the witness hash
        assertTrue(witness1 != witness2, "witness should differ for different params");
    }

    // ── witness is set by contract, not by caller ──────────────────
    // Caller passes witness=bytes32(0). Contract overwrites it before calling
    // Permit2. Verify the recorded witness is non-zero.

    function test_Permit2_WitnessOverwrittenByContract() public {
        uint128 amt  = 5e6;
        uint64  end_ = uint64(block.timestamp) + 3600;
        _depositAs(alice, _payLaterParams(bob, amt, end_, false));

        // The mock records what the contract actually sent
        assertTrue(permit2.lastWitnessValue() != bytes32(0),
            "contract must overwrite zero witness with real hash");
    }

    // ── canonical witnessTypeString is passed correctly ──────────────────────
    // Real Permit2 takes a string (the type definition) not a bytes32 hash.
    // Verify the contract passes the correct canonical type string with TokenPermissions suffix.

    function test_Permit2_WitnessTypeStringPassedCorrectly() public {
        uint128 amt  = 5e6;
        uint64  end_ = uint64(block.timestamp) + 3600;
        _depositAs(alice, _payLaterParams(bob, amt, end_, false));

        string memory expectedTypeString = "ScheduleWitness(bytes32 scheduleId,address recipient,uint8 scheduleType,bool revocable,uint64 startTime,uint64 endTime,uint64 cliffEnd,uint64 period,uint128 periodAmount,uint128 totalAmount) TokenPermissions(address token,uint256 amount)";
        assertEq(permit2.lastWitnessTypeString(), expectedTypeString);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAUSE
// ─────────────────────────────────────────────────────────────────────────────
contract ScheduledPayoutsPauseTest is ScheduledPayoutsTestBase {

    uint128 constant AMT  = 5e6;
    uint64  constant HOUR = 3600;

    // ── pause / unpause access control ───────────────────────────

    function test_Pause_NonPauserCannotPause() public {
        vm.prank(alice);
        vm.expectRevert(); // AccessControl revert
        sp.pause();
    }

    function test_Pause_NonPauserCannotUnpause() public {
        vm.prank(admin);
        sp.pause();

        vm.prank(alice);
        vm.expectRevert();
        sp.unpause();
    }

    function test_Pause_PauserCanPause() public {
        vm.prank(admin);
        sp.pause();
        assertTrue(sp.paused());
    }

    function test_Pause_PauserCanUnpause() public {
        vm.prank(admin);
        sp.pause();
        vm.prank(admin);
        sp.unpause();
        assertFalse(sp.paused());
    }

    // ── deposit blocked when paused ───────────────────────────────

    function test_Pause_DepositRevertsWhenPaused() public {
        vm.prank(admin);
        sp.pause();

        PermitTransferFrom memory p = _buildWitnessPermit(AMT);
        ScheduledPayouts.ScheduleParams memory params = _payLaterParams(bob, AMT, uint64(block.timestamp) + HOUR, false);

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        sp.deposit(p, DUMMY_SIG, params);
    }

    // ── claim and cancel work while paused ────────────────────────

    function test_Pause_ClaimWorksWhilePaused() public {
        // Create schedule while unpaused
        uint64 end_ = uint64(block.timestamp) + HOUR;
        bytes32 id  = _depositAs(alice, _payLaterParams(bob, AMT, end_, false));

        // Pause, warp, claim
        vm.prank(admin);
        sp.pause();

        vm.warp(end_);
        sp.claim(id);  // must NOT revert

        assertEq(usdc.balanceOf(bob), AMT);
    }

    function test_Pause_CancelWorksWhilePaused() public {
        // Create revocable schedule while unpaused
        uint64 start = uint64(block.timestamp);
        uint64 end_  = start + HOUR;
        bytes32 id   = _depositAs(alice, _streamingParams(bob, AMT, start, end_, true));

        // Pause then cancel
        vm.prank(admin);
        sp.pause();

        vm.warp(start);  // 0 streamed
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        sp.cancel(id);  // must NOT revert

        assertEq(usdc.balanceOf(alice), aliceBefore + AMT);
    }

    // ── deposit works after unpause ───────────────────────────────

    function test_Pause_DepositWorksAfterUnpause() public {
        vm.prank(admin);
        sp.pause();
        vm.prank(admin);
        sp.unpause();

        uint64 end_ = uint64(block.timestamp) + HOUR;
        // Should not revert
        bytes32 id = _depositAs(alice, _payLaterParams(bob, AMT, end_, false));
        (address sender,,,,,,,,,,,) = sp.schedules(id);
        assertEq(sender, alice);
    }
}
