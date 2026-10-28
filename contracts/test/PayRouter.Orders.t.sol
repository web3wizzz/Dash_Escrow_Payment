// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PayRouterTestBase} from "./PayRouter.Base.t.sol";
import {PayRouter, PermitTransferFrom} from "../PayRouter.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract PayRouterOrdersTest is PayRouterTestBase {

    bytes32 internal constant ACCOUNT_HASH = keccak256("account-1");
    bytes32 internal constant REF          = keccak256("ref-1");
    uint256 internal constant ORDER_AMOUNT = 10 * 1e6; // 10 USDC, within Tier-1 cap

    // ─────────────────────────────────────────────────────────────
    // CREATE ORDER — happy path
    // ─────────────────────────────────────────────────────────────

    function test_CreateOrder_HappyPath_Tier1() public {
        PermitTransferFrom memory permit = _buildWitnessPermit(ORDER_AMOUNT);

        vm.prank(bob); // Tier-1
        bytes32 orderId = router.createOrder(permit, DUMMY_SIG, billerAddress, ACCOUNT_HASH, REF, ORDER_AMOUNT);

        // Order stored correctly
        (address payer, address treasury, uint128 amount,, , PayRouter.OrderStatus status) = _getOrder(orderId);
        assertEq(payer,    bob);
        assertEq(treasury, billerTreasury);
        assertEq(amount,   ORDER_AMOUNT);
        assertEq(uint8(status), uint8(PayRouter.OrderStatus.Pending));
    }

    function test_CreateOrder_EmitsOrderCreated() public {
        PermitTransferFrom memory permit = _buildWitnessPermit(ORDER_AMOUNT);

        vm.prank(bob);
        vm.expectEmit(false, true, true, false, address(router)); // orderId unknown; check payer + billerId
        emit PayRouter.OrderCreated(bytes32(0), bob, billerAddress, ACCOUNT_HASH, REF, ORDER_AMOUNT);
        router.createOrder(permit, DUMMY_SIG, billerAddress, ACCOUNT_HASH, REF, ORDER_AMOUNT);
    }

    function test_CreateOrder_PermitWitnessMockCalled() public {
        PermitTransferFrom memory permit = _buildWitnessPermit(ORDER_AMOUNT);

        vm.prank(bob);
        bytes32 orderId = router.createOrder(permit, DUMMY_SIG, billerAddress, ACCOUNT_HASH, REF, ORDER_AMOUNT);

        assertEq(permit2.witnessCallCount(), 1);
        assertEq(permit2.lastWitnessOwner(), bob);

        // Verify the canonical witnessTypeString was passed (includes TokenPermissions suffix)
        string memory expectedTypeString = "BillOrderWitness(bytes32 orderId,address billerId,bytes32 accountHash,bytes32 ref) TokenPermissions(address token,uint256 amount)";
        assertEq(permit2.lastWitnessTypeString(), expectedTypeString);

        // Verify the witness hash encodes orderId, billerId, accountHash, ref correctly
        bytes32 expectedWitness = _expectedWitness(orderId, billerAddress, ACCOUNT_HASH, REF);
        assertEq(permit2.lastWitnessValue(), expectedWitness);
    }

    function test_CreateOrder_EscrowledInRouter() public {
        PermitTransferFrom memory permit = _buildWitnessPermit(ORDER_AMOUNT);
        uint256 routerBefore = usdc.balanceOf(address(router));

        vm.prank(bob);
        router.createOrder(permit, DUMMY_SIG, billerAddress, ACCOUNT_HASH, REF, ORDER_AMOUNT);

        assertEq(usdc.balanceOf(address(router)), routerBefore + ORDER_AMOUNT);
    }

    // ─────────────────────────────────────────────────────────────
    // CREATE ORDER — reverts
    // ─────────────────────────────────────────────────────────────

    function test_CreateOrder_Tier0_Succeeds_Permissionless() public {
        // Permissionless model: alice is Tier-0 and minBillTier=0 — must succeed.
        // Previously this would revert with InsufficientTierForBillOrder; that
        // error and check have been removed.  This test documents the new behaviour.
        assertEq(kyc.effectiveTier(alice), 0, "alice is Tier 0");
        assertEq(router.minBillTier(), 0, "minBillTier is 0");

        PermitTransferFrom memory permit = _buildWitnessPermit(ORDER_AMOUNT);

        vm.prank(alice);
        bytes32 orderId = router.createOrder(permit, DUMMY_SIG, billerAddress, ACCOUNT_HASH, REF, ORDER_AMOUNT);

        // Verify order was recorded
        (address payer,,,,, PayRouter.OrderStatus status) = router.orders(orderId);
        assertEq(payer, alice);
        assertEq(uint8(status), uint8(PayRouter.OrderStatus.Pending));
    }

    function test_RevertCreateOrder_InvalidBiller() public {
        address fakeBiller = makeAddr("fakeBiller");
        PermitTransferFrom memory permit = _buildWitnessPermit(ORDER_AMOUNT);

        vm.prank(bob);
        vm.expectRevert(PayRouter.InvalidBiller.selector);
        router.createOrder(permit, DUMMY_SIG, fakeBiller, ACCOUNT_HASH, REF, ORDER_AMOUNT);
    }

    function test_RevertCreateOrder_WhenPaused() public {
        vm.prank(admin);
        router.pause();

        PermitTransferFrom memory permit = _buildWitnessPermit(ORDER_AMOUNT);

        vm.prank(bob);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        router.createOrder(permit, DUMMY_SIG, billerAddress, ACCOUNT_HASH, REF, ORDER_AMOUNT);
    }

    // ─────────────────────────────────────────────────────────────
    // FULFILL ORDER
    // ─────────────────────────────────────────────────────────────

    function test_FulfillOrder_HappyPath_ZeroFee() public {
        bytes32 orderId = _createOrderAsBob();
        uint256 treasuryBefore = usdc.balanceOf(billerTreasury);

        vm.prank(operator);
        router.fulfillOrder(orderId);

        assertEq(usdc.balanceOf(billerTreasury), treasuryBefore + ORDER_AMOUNT);
        assertEq(uint8(_orderStatus(orderId)), uint8(PayRouter.OrderStatus.Fulfilled));
    }

    function test_FulfillOrder_EmitsEvent() public {
        bytes32 orderId = _createOrderAsBob();

        vm.prank(operator);
        vm.expectEmit(true, true, false, true, address(router));
        emit PayRouter.OrderFulfilled(orderId, billerTreasury, ORDER_AMOUNT, 0);
        router.fulfillOrder(orderId);
    }

    function test_FulfillOrder_WithFee() public {
        // Set feeBps to 100 (1%) via timelock
        _setFeeBpsViaTimelock(100);

        bytes32 orderId = _createOrderAsBob();

        uint256 treasuryBefore = usdc.balanceOf(billerTreasury);
        uint256 feeWalletBefore = usdc.balanceOf(feeWalletAddr);

        vm.prank(operator);
        router.fulfillOrder(orderId);

        uint256 expectedFee = ORDER_AMOUNT * 100 / 10_000; // 1%
        uint256 expectedNet = ORDER_AMOUNT - expectedFee;

        assertEq(usdc.balanceOf(billerTreasury), treasuryBefore  + expectedNet);
        assertEq(usdc.balanceOf(feeWalletAddr),  feeWalletBefore + expectedFee);
    }

    function test_RevertFulfillOrder_NonOperator() public {
        bytes32 orderId = _createOrderAsBob();
        bytes32 opRole = router.OPERATOR_ROLE();

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                alice,
                opRole
            )
        );
        router.fulfillOrder(orderId);
    }

    function test_RevertFulfillOrder_NotPending() public {
        bytes32 orderId = _createOrderAsBob();

        vm.prank(operator);
        router.fulfillOrder(orderId);

        vm.prank(operator);
        vm.expectRevert(PayRouter.OrderNotPending.selector);
        router.fulfillOrder(orderId);
    }

    /// @dev Once the 30-minute reclaim window opens the operator can no longer fulfill.
    ///      This is the escrow deadline snapshot: fulfillment is impossible after expiry.
    function test_RevertFulfillOrder_AfterExpiry() public {
        bytes32 orderId = _createOrderAsBob();

        // Warp exactly to expiry boundary
        vm.warp(block.timestamp + ORDER_TIMEOUT);

        vm.prank(operator);
        vm.expectRevert(PayRouter.OrderNotPending.selector);
        router.fulfillOrder(orderId);
    }

    function test_FulfillOrder_SucceedsOneSecondBeforeExpiry() public {
        bytes32 orderId = _createOrderAsBob();

        // One second before the timeout is still within the fulfillment window
        vm.warp(block.timestamp + ORDER_TIMEOUT - 1);

        uint256 treasuryBefore = usdc.balanceOf(billerTreasury);
        vm.prank(operator);
        router.fulfillOrder(orderId);

        assertEq(usdc.balanceOf(billerTreasury), treasuryBefore + ORDER_AMOUNT);
    }

    // ─────────────────────────────────────────────────────────────
    // REJECT ORDER
    // ─────────────────────────────────────────────────────────────

    function test_RejectOrder_ReturnsFullAmountToPayer() public {
        bytes32 orderId = _createOrderAsBob();
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.prank(operator);
        router.rejectOrder(orderId);

        assertEq(usdc.balanceOf(bob), bobBefore + ORDER_AMOUNT);
        assertEq(uint8(_orderStatus(orderId)), uint8(PayRouter.OrderStatus.Rejected));
    }

    function test_RejectOrder_EmitsEvent() public {
        bytes32 orderId = _createOrderAsBob();

        vm.prank(operator);
        vm.expectEmit(true, true, false, true, address(router));
        emit PayRouter.OrderRejected(orderId, bob, ORDER_AMOUNT);
        router.rejectOrder(orderId);
    }

    function test_RejectOrder_NoFeeCharged() public {
        _setFeeBpsViaTimelock(100); // 1% fee active
        bytes32 orderId = _createOrderAsBob();
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.prank(operator);
        router.rejectOrder(orderId);

        // Full amount returned, no fee deducted
        assertEq(usdc.balanceOf(bob), bobBefore + ORDER_AMOUNT);
    }

    function test_RevertRejectOrder_NotPending() public {
        bytes32 orderId = _createOrderAsBob();

        vm.prank(operator);
        router.rejectOrder(orderId);

        vm.prank(operator);
        vm.expectRevert(PayRouter.OrderNotPending.selector);
        router.rejectOrder(orderId);
    }

    // ─────────────────────────────────────────────────────────────
    // RECLAIM ORDER
    // ─────────────────────────────────────────────────────────────

    function test_RevertReclaimOrder_BeforeTimeout() public {
        bytes32 orderId = _createOrderAsBob();

        vm.prank(bob);
        vm.expectRevert(PayRouter.OrderNotExpired.selector);
        router.reclaimOrder(orderId);
    }

    function test_ReclaimOrder_AfterTimeout_Succeeds() public {
        bytes32 orderId = _createOrderAsBob();
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.warp(block.timestamp + ORDER_TIMEOUT);

        vm.prank(bob);
        router.reclaimOrder(orderId);

        assertEq(usdc.balanceOf(bob), bobBefore + ORDER_AMOUNT);
        assertEq(uint8(_orderStatus(orderId)), uint8(PayRouter.OrderStatus.Reclaimed));
    }

    function test_ReclaimOrder_EmitsEvent() public {
        bytes32 orderId = _createOrderAsBob();

        vm.warp(block.timestamp + ORDER_TIMEOUT);

        vm.prank(bob);
        vm.expectEmit(true, true, false, true, address(router));
        emit PayRouter.OrderReclaimed(orderId, bob, ORDER_AMOUNT);
        router.reclaimOrder(orderId);
    }

    function test_RevertReclaimOrder_NotPending() public {
        bytes32 orderId = _createOrderAsBob();

        vm.prank(operator);
        router.fulfillOrder(orderId);

        vm.warp(block.timestamp + ORDER_TIMEOUT);

        vm.prank(bob);
        vm.expectRevert(PayRouter.OrderNotPending.selector);
        router.reclaimOrder(orderId);
    }

    // ─────────────────────────────────────────────────────────────
    // PAUSED — fulfill/reject/reclaim still work
    // ─────────────────────────────────────────────────────────────

    function test_Paused_FulfillOrderStillWorks() public {
        bytes32 orderId = _createOrderAsBob();

        vm.prank(admin);
        router.pause();

        // fulfill is not gated by whenNotPaused
        vm.prank(operator);
        router.fulfillOrder(orderId);

        assertEq(uint8(_orderStatus(orderId)), uint8(PayRouter.OrderStatus.Fulfilled));
    }

    function test_Paused_RejectOrderStillWorks() public {
        bytes32 orderId = _createOrderAsBob();

        vm.prank(admin);
        router.pause();

        vm.prank(operator);
        router.rejectOrder(orderId);

        assertEq(uint8(_orderStatus(orderId)), uint8(PayRouter.OrderStatus.Rejected));
    }

    function test_Paused_ReclaimOrderStillWorks() public {
        bytes32 orderId = _createOrderAsBob();

        vm.prank(admin);
        router.pause();

        vm.warp(block.timestamp + ORDER_TIMEOUT);

        vm.prank(bob);
        router.reclaimOrder(orderId);

        assertEq(uint8(_orderStatus(orderId)), uint8(PayRouter.OrderStatus.Reclaimed));
    }

    // ─────────────────────────────────────────────────────────────
    // WITNESS MISMATCH SECURITY TEST
    // ─────────────────────────────────────────────────────────────

    /// @dev Verifies that the witness passed to Permit2 encodes billerId, accountHash, ref.
    ///      If any of these differ at signing vs. submission, the computed witness changes
    ///      and real Permit2 would reject the signature.
    function test_WitnessMismatch_DifferentBillerIdChangesWitness() public {
        address biller2 = makeAddr("biller2");
        // Add biller2 via timelock
        _addBillerViaTimelock(biller2, makeAddr("biller2Treasury"));

        // Create two orders with different billerIds
        PermitTransferFrom memory permit1 = _buildWitnessPermit(ORDER_AMOUNT);
        vm.prank(bob);
        bytes32 orderId1 = router.createOrder(permit1, DUMMY_SIG, billerAddress, ACCOUNT_HASH, REF, ORDER_AMOUNT);

        // re-mint so bob has funds for second order
        usdc.mint(bob, ORDER_AMOUNT);

        PermitTransferFrom memory permit2 = _buildWitnessPermit(ORDER_AMOUNT);
        vm.prank(bob);
        bytes32 orderId2 = router.createOrder(permit2, DUMMY_SIG, biller2, ACCOUNT_HASH, REF, ORDER_AMOUNT);

        // Witness values must differ because billerIds differ
        bytes32 w1 = _expectedWitness(orderId1, billerAddress, ACCOUNT_HASH, REF);
        bytes32 w2 = _expectedWitness(orderId2, biller2,       ACCOUNT_HASH, REF);
        assertTrue(w1 != w2, "Witness must differ when billerId differs");
    }

    function test_WitnessMismatch_DifferentAccountHashChangesWitness() public {
        PermitTransferFrom memory permit = _buildWitnessPermit(ORDER_AMOUNT);
        vm.prank(bob);
        bytes32 orderId = router.createOrder(permit, DUMMY_SIG, billerAddress, ACCOUNT_HASH, REF, ORDER_AMOUNT);

        bytes32 differentAccountHash = keccak256("account-2");
        bytes32 w1 = _expectedWitness(orderId, billerAddress, ACCOUNT_HASH,         REF);
        bytes32 w2 = _expectedWitness(orderId, billerAddress, differentAccountHash, REF);
        assertTrue(w1 != w2, "Witness must differ when accountHash differs");
    }

    function test_WitnessMismatch_DifferentRefChangesWitness() public {
        PermitTransferFrom memory permit = _buildWitnessPermit(ORDER_AMOUNT);
        vm.prank(bob);
        bytes32 orderId = router.createOrder(permit, DUMMY_SIG, billerAddress, ACCOUNT_HASH, REF, ORDER_AMOUNT);

        bytes32 differentRef = keccak256("ref-2");
        bytes32 w1 = _expectedWitness(orderId, billerAddress, ACCOUNT_HASH, REF);
        bytes32 w2 = _expectedWitness(orderId, billerAddress, ACCOUNT_HASH, differentRef);
        assertTrue(w1 != w2, "Witness must differ when ref differs");
    }

    // ─────────────────────────────────────────────────────────────
    // CONCURRENT TWO-PAYER TEST
    // Proves per-payer nonces eliminate nonce interference between payers.
    // ─────────────────────────────────────────────────────────────

    /// @dev Two payers (bob and carol) each sign an orderId computed from their own nonce.
    ///      Both transactions succeed with no revert, proving nonce isolation.
    function test_ConcurrentTwoPayers_NoNonceInterference() public {
        // bob's nonce is 0, carol's nonce is also 0 — but they are independent mappings
        uint256 bobNonce   = router.orderNonceOf(bob);
        uint256 carolNonce = router.orderNonceOf(carol);
        assertEq(bobNonce,   0, "bob nonce should start at 0");
        assertEq(carolNonce, 0, "carol nonce should start at 0");

        // bob creates an order
        PermitTransferFrom memory permitBob = _buildWitnessPermit(ORDER_AMOUNT);
        vm.prank(bob);
        bytes32 orderIdBob = router.createOrder(permitBob, DUMMY_SIG, billerAddress, ACCOUNT_HASH, REF, ORDER_AMOUNT);

        // carol creates an order in the SAME block (same block.number, same block.timestamp)
        // with different biller ref so orderId is distinct even if nonces were equal
        bytes32 carolRef = keccak256("carol-ref");
        PermitTransferFrom memory permitCarol = _buildWitnessPermit(ORDER_AMOUNT);
        vm.prank(carol);
        bytes32 orderIdCarol = router.createOrder(permitCarol, DUMMY_SIG, billerAddress, ACCOUNT_HASH, carolRef, ORDER_AMOUNT);

        // Both orders are distinct and pending
        assertTrue(orderIdBob != orderIdCarol, "Order IDs must be distinct");
        (address payerBob,,,,, PayRouter.OrderStatus statusBob) = router.orders(orderIdBob);
        (address payerCarol,,,,, PayRouter.OrderStatus statusCarol) = router.orders(orderIdCarol);
        assertEq(payerBob,   bob);
        assertEq(payerCarol, carol);
        assertEq(uint8(statusBob),   uint8(PayRouter.OrderStatus.Pending));
        assertEq(uint8(statusCarol), uint8(PayRouter.OrderStatus.Pending));

        // bob's nonce advanced to 1; carol's nonce advanced to 1 independently
        assertEq(router.orderNonceOf(bob),   1, "bob nonce should be 1 after one order");
        assertEq(router.orderNonceOf(carol), 1, "carol nonce should be 1 after one order");
    }

    /// @dev Demonstrates orderId uniqueness: same payer, two sequential orders each get a distinct id.
    function test_SequentialOrders_SamePayer_UniqueIds() public {
        // First order
        PermitTransferFrom memory p1 = _buildWitnessPermit(ORDER_AMOUNT);
        vm.prank(bob);
        bytes32 id1 = router.createOrder(p1, DUMMY_SIG, billerAddress, ACCOUNT_HASH, REF, ORDER_AMOUNT);

        // Second order — nonce now 1
        usdc.mint(bob, ORDER_AMOUNT);
        bytes32 ref2 = keccak256("ref-2");
        PermitTransferFrom memory p2 = _buildWitnessPermit(ORDER_AMOUNT);
        vm.prank(bob);
        bytes32 id2 = router.createOrder(p2, DUMMY_SIG, billerAddress, ACCOUNT_HASH, ref2, ORDER_AMOUNT);

        assertTrue(id1 != id2, "Sequential orders from same payer must have distinct IDs");
        assertEq(router.orderNonceOf(bob), 2, "bob nonce should be 2 after two orders");
    }

    // ─────────────────────────────────────────────────────────────
    // INTERNAL HELPERS
    // ─────────────────────────────────────────────────────────────

    function _createOrderAsBob() internal returns (bytes32 orderId) {
        PermitTransferFrom memory permit = _buildWitnessPermit(ORDER_AMOUNT);
        vm.prank(bob);
        orderId = router.createOrder(permit, DUMMY_SIG, billerAddress, ACCOUNT_HASH, REF, ORDER_AMOUNT);
    }

    function _getOrder(bytes32 orderId) internal view returns (
        address payer, address treasury, uint128 amount,
        uint128 feeBps_, uint64 createdAt, PayRouter.OrderStatus status
    ) {
        (payer, treasury, amount, feeBps_, createdAt, status) = router.orders(orderId);
    }

    function _orderStatus(bytes32 orderId) internal view returns (PayRouter.OrderStatus) {
        (,,,,, PayRouter.OrderStatus s) = router.orders(orderId);
        return s;
    }

    /// Queue + warp + execute feeBps change via timelock.
    function _setFeeBpsViaTimelock(uint16 newBps) internal {
        bytes32 changeKey = keccak256("feeBps");
        bytes memory payload = abi.encode(newBps);

        vm.prank(admin);
        router.queueConfigChange(changeKey, payload);

        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(admin);
        router.executeConfigChange(changeKey);
    }

    function _addBillerViaTimelock(address biller, address treasury) internal {
        bytes32 changeKey = keccak256("addBiller");
        bytes memory payload = abi.encode(biller, treasury);

        vm.prank(admin);
        router.queueConfigChange(changeKey, payload);

        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(admin);
        router.executeConfigChange(changeKey);
    }
}
