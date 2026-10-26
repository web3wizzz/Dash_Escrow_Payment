// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PayRouterTestBase} from "./PayRouter.Base.t.sol";
import {PayRouter} from "../PayRouter.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract PayRouterTimelockTest is PayRouterTestBase {

    bytes32 internal constant CHANGE_FEE_BPS = keccak256("feeBps");

    // ─────────────────────────────────────────────────────────────
    // TIMELOCK — queue + execute
    // ─────────────────────────────────────────────────────────────

    function test_QueueConfigChange_EmitsEvent() public {
        bytes memory payload = abi.encode(uint16(50));

        vm.prank(admin);
        vm.expectEmit(true, false, false, false, address(router));
        emit PayRouter.ConfigChangeQueued(CHANGE_FEE_BPS, 0); // eta ignored in check
        router.queueConfigChange(CHANGE_FEE_BPS, payload);
    }

    function test_RevertExecuteConfigChange_BeforeDelay() public {
        bytes memory payload = abi.encode(uint16(50));

        vm.prank(admin);
        router.queueConfigChange(CHANGE_FEE_BPS, payload);

        // Try to execute immediately
        vm.prank(admin);
        vm.expectRevert(PayRouter.TimelockNotReady.selector);
        router.executeConfigChange(CHANGE_FEE_BPS);
    }

    function test_ExecuteConfigChange_AfterDelay_UpdatesFeeBps() public {
        uint16 newBps = 100;
        bytes memory payload = abi.encode(newBps);

        vm.prank(admin);
        router.queueConfigChange(CHANGE_FEE_BPS, payload);

        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(admin);
        vm.expectEmit(true, false, false, false, address(router));
        emit PayRouter.ConfigChangeExecuted(CHANGE_FEE_BPS);
        router.executeConfigChange(CHANGE_FEE_BPS);

        assertEq(router.feeBps(), newBps);
    }

    function test_RevertExecuteConfigChange_AlreadyExecuted() public {
        bytes memory payload = abi.encode(uint16(50));

        vm.prank(admin);
        router.queueConfigChange(CHANGE_FEE_BPS, payload);

        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(admin);
        router.executeConfigChange(CHANGE_FEE_BPS);

        vm.prank(admin);
        vm.expectRevert(PayRouter.TimelockAlreadyExecuted.selector);
        router.executeConfigChange(CHANGE_FEE_BPS);
    }

    function test_RevertExecuteConfigChange_NotQueued() public {
        bytes32 unqueued = keccak256("feeBps"); // feeBps key but nothing queued

        vm.prank(admin);
        vm.expectRevert(PayRouter.TimelockNotQueued.selector);
        router.executeConfigChange(unqueued);
    }

    function test_TimelockCanChangeGlobalPerPaymentCap() public {
        bytes32 changeKey = keccak256("globalPerPaymentCap");
        uint96 newCap = 30_000_000;
        bytes memory payload = abi.encode(newCap);

        vm.prank(admin);
        router.queueConfigChange(changeKey, payload);

        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(admin);
        router.executeConfigChange(changeKey);

        assertEq(router.globalPerPaymentCap(), newCap);
    }

    function test_TimelockCanAddBiller() public {
        address newBiller   = makeAddr("newBiller");
        address newTreasury = makeAddr("newTreasury");

        bytes32 changeKey = keccak256("addBiller");
        bytes memory payload = abi.encode(newBiller, newTreasury);

        vm.prank(admin);
        router.queueConfigChange(changeKey, payload);

        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(admin);
        vm.expectEmit(true, true, false, false, address(router));
        emit PayRouter.BillerAdded(newBiller, newTreasury);
        router.executeConfigChange(changeKey);

        assertTrue(router.isBiller(newBiller));
        assertEq(router.billerTreasury(newBiller), newTreasury);
    }

    function test_TimelockCanRemoveBiller() public {
        bytes32 changeKey = keccak256("removeBiller");
        bytes memory payload = abi.encode(billerAddress);

        vm.prank(admin);
        router.queueConfigChange(changeKey, payload);

        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(admin);
        vm.expectEmit(true, false, false, false, address(router));
        emit PayRouter.BillerRemoved(billerAddress);
        router.executeConfigChange(changeKey);

        assertFalse(router.isBiller(billerAddress));
    }

    function test_RevertQueueConfigChange_UnsupportedKey() public {
        bytes32 badKey = keccak256("badKey");
        vm.prank(admin);
        vm.expectRevert(PayRouter.InvalidConfig.selector);
        router.queueConfigChange(badKey, abi.encode(uint256(1)));
    }

    function test_RevertQueueConfigChange_EmptyPayload() public {
        vm.prank(admin);
        vm.expectRevert(PayRouter.InvalidConfig.selector);
        router.queueConfigChange(CHANGE_FEE_BPS, new bytes(0));
    }

    function test_RevertQueueConfigChange_NonAdmin() public {
        bytes32 adminRole = router.DEFAULT_ADMIN_ROLE();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                alice,
                adminRole
            )
        );
        router.queueConfigChange(CHANGE_FEE_BPS, abi.encode(uint16(50)));
    }

    // ─────────────────────────────────────────────────────────────
    // PAUSE / UNPAUSE
    // ─────────────────────────────────────────────────────────────

    function test_PauserRole_CanPause() public {
        vm.prank(admin); // admin has PAUSER_ROLE from constructor
        router.pause();

        assertTrue(router.paused());
    }

    function test_PauserRole_CanUnpause() public {
        vm.prank(admin);
        router.pause();

        vm.prank(admin);
        router.unpause();

        assertFalse(router.paused());
    }

    function test_RevertPause_NonPauserRole() public {
        bytes32 pauserRole = router.PAUSER_ROLE();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                alice,
                pauserRole
            )
        );
        router.pause();
    }

    function test_RevertUnpause_NonPauserRole() public {
        vm.prank(admin);
        router.pause();

        bytes32 pauserRole = router.PAUSER_ROLE();
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                alice,
                pauserRole
            )
        );
        router.unpause();
    }

    function test_GrantPauserRole_CanPause() public {
        address pauser = makeAddr("pauser");
        bytes32 pauserRole = router.PAUSER_ROLE();

        vm.prank(admin);
        router.grantRole(pauserRole, pauser);

        vm.prank(pauser);
        router.pause();

        assertTrue(router.paused());
    }

    // ─────────────────────────────────────────────────────────────
    // T-01: Re-queuing a pending (unexecuted) change is blocked
    // ─────────────────────────────────────────────────────────────

    /// @dev Verifies that queueConfigChange reverts with TimelockPendingExecution
    ///      if the same key has a queued but unexecuted change.
    function test_RevertQueueConfigChange_PendingExecution() public {
        bytes memory payload1 = abi.encode(uint16(50));
        bytes memory payload2 = abi.encode(uint16(100));

        // Queue the first change
        vm.prank(admin);
        router.queueConfigChange(CHANGE_FEE_BPS, payload1);

        // Attempt to re-queue before execution — must revert
        vm.prank(admin);
        vm.expectRevert(PayRouter.TimelockPendingExecution.selector);
        router.queueConfigChange(CHANGE_FEE_BPS, payload2);
    }

    // ─────────────────────────────────────────────────────────────
    // CHANGE_FEE_WALLET via timelock
    // ─────────────────────────────────────────────────────────────

    function test_TimelockCanChangeFeeWallet() public {
        address newFeeWallet = makeAddr("newFeeWallet");
        bytes32 changeKey    = keccak256("feeWallet");

        vm.prank(admin);
        router.queueConfigChange(changeKey, abi.encode(newFeeWallet));

        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(admin);
        router.executeConfigChange(changeKey);

        assertEq(router.feeWallet(), newFeeWallet, "feeWallet should update after timelock");
    }

    function test_RevertFeeWalletChange_ZeroAddress() public {
        bytes32 changeKey = keccak256("feeWallet");

        vm.prank(admin);
        router.queueConfigChange(changeKey, abi.encode(address(0)));

        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(admin);
        vm.expectRevert(PayRouter.ZeroAddress.selector);
        router.executeConfigChange(changeKey);
    }

    /// @dev After executing the first queued change, a new one can be queued.
    function test_QueueConfigChange_AfterExecution_Succeeds() public {
        bytes memory payload1 = abi.encode(uint16(50));
        bytes memory payload2 = abi.encode(uint16(100));

        // Use absolute timestamps to avoid Foundry IR-mode block.timestamp capture quirks.
        uint256 deploy   = 1;         // Foundry default initial block.timestamp
        uint256 warp1    = deploy + 24 hours + 1;   // 86402
        uint256 warp2    = warp1 + 24 hours + 1;    // 172803

        vm.prank(admin);
        router.queueConfigChange(CHANGE_FEE_BPS, payload1);

        vm.warp(warp1);
        vm.prank(admin);
        router.executeConfigChange(CHANGE_FEE_BPS);
        assertEq(router.feeBps(), 50);

        // Queue a second change (first is now executed, so guard passes)
        vm.prank(admin);
        router.queueConfigChange(CHANGE_FEE_BPS, payload2);

        // ETA for second change is warp1 + 24h = 172801. Warp past it.
        vm.warp(warp2);
        vm.prank(admin);
        router.executeConfigChange(CHANGE_FEE_BPS);
        assertEq(router.feeBps(), 100);
    }
}
