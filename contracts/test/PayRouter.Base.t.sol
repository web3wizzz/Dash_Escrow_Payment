// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockERC20}   from "../test-helpers/MockERC20.sol";
import {MockPermit2} from "../test-helpers/MockPermit2.sol";
import {KycRegistry}    from "../KycRegistry.sol";
import {HandleRegistry} from "../HandleRegistry.sol";
import {PayRouter, InitialBiller, PermitTransferFrom,
        SignatureTransferDetails, TokenPermissions} from "../PayRouter.sol";

abstract contract PayRouterTestBase is Test {
    // ── deployed contracts ────────────────────────────────────────
    MockERC20       internal usdc;
    MockPermit2     internal permit2;
    KycRegistry     internal kyc;
    HandleRegistry  internal handleReg;
    PayRouter       internal router;

    // ── actors ────────────────────────────────────────────────────
    address internal admin          = makeAddr("admin");
    address internal operator       = makeAddr("operator");
    address internal alice          = makeAddr("alice");   // Tier-0 (default)
    address internal bob            = makeAddr("bob");     // Tier-1
    address internal carol          = makeAddr("carol");   // Tier-2
    address internal billerAddress  = makeAddr("biller");
    address internal billerTreasury = makeAddr("billerTreasury");
    address internal feeWalletAddr;   // set to admin in constructor

    // ── tier caps (mirror spec) ───────────────────────────────────
    uint96 internal constant T0_PER_PAYMENT  = 5_000_000;      // 5 USDC
    uint96 internal constant T0_DAILY        = 50_000_000;     // 50 USDC
    uint96 internal constant T1_PER_PAYMENT  = 100_000_000;    // 100 USDC
    uint96 internal constant T1_DAILY        = 20_000_000_000_000; // very large
    uint96 internal constant T2_PER_PAYMENT  = 20_000_000_000_000; // very large
    uint96 internal constant T2_DAILY        = 0;              // unlimited
    uint96 internal constant GLOBAL_CAP      = 25_000_000;     // 25 USDC
    uint16 internal constant FEE_BPS_INIT    = 0;
    uint8  internal constant MIN_BILL_TIER   = 1;
    uint32 internal constant ORDER_TIMEOUT   = 1800;           // 30 min

    // ── helpers ───────────────────────────────────────────────────
    uint256 internal constant USDC_6 = 1e6; // 1 USDC = 1_000_000 units

    function setUp() public virtual {
        // 1. Deploy mock USDC (6 decimals)
        usdc = new MockERC20("Mock USDC", "mUSDC", 6);

        // 2. Deploy mock Permit2 (enforceSenderCheck = false for normal router flows;
        //    real Permit2 verifies the EIP-712 sig tied to `owner`, not msg.sender==owner).
        permit2 = new MockPermit2(false);

        // 3. Deploy KycRegistry
        kyc = new KycRegistry(admin);

        // 4. Deploy HandleRegistry (no reserved handles for base)
        bytes32[] memory emptyReserved = new bytes32[](0);
        handleReg = new HandleRegistry(admin, emptyReserved);

        // 5. Deploy PayRouter
        InitialBiller[] memory initialBillers = new InitialBiller[](1);
        initialBillers[0] = InitialBiller({biller: billerAddress, treasury: billerTreasury});

        router = new PayRouter(
            address(usdc),
            address(kyc),
            address(handleReg),
            address(permit2),
            admin,
            PayRouter.TierConfig({perPaymentCap: T0_PER_PAYMENT, dailyCap: T0_DAILY}),
            PayRouter.TierConfig({perPaymentCap: T1_PER_PAYMENT, dailyCap: T1_DAILY}),
            PayRouter.TierConfig({perPaymentCap: T2_PER_PAYMENT, dailyCap: T2_DAILY}),
            GLOBAL_CAP,
            MIN_BILL_TIER,
            ORDER_TIMEOUT,
            FEE_BPS_INIT,
            initialBillers
        );
        feeWalletAddr = admin; // PayRouter sets feeWallet = initialAdmin

        // 6. Grant operator role — read role constant BEFORE prank so the view call
        //    doesn't consume the prank token.
        bytes32 operatorRole  = router.OPERATOR_ROLE();
        vm.prank(admin);
        router.grantRole(operatorRole, operator);

        // 7. Seed USDC balances for actors + approve Permit2
        _seedAndApprove(alice,  1_000 * USDC_6);
        _seedAndApprove(bob,    1_000 * USDC_6);
        _seedAndApprove(carol,  1_000 * USDC_6);

        // 8. Set KYC tiers
        bytes32 verifierRole = kyc.VERIFIER_ROLE();
        vm.prank(admin);
        kyc.grantRole(verifierRole, admin);

        uint64 farFuture = type(uint64).max;
        // alice stays Tier-0 (no setTier call)
        vm.prank(admin);
        kyc.setTier(bob,   1, farFuture);
        vm.prank(admin);
        kyc.setTier(carol, 2, farFuture);
    }

    // ── internal helpers ──────────────────────────────────────────

    function _seedAndApprove(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        // Allow MockPermit2 to pull from `who`
        vm.prank(who);
        usdc.approve(address(permit2), type(uint256).max);
    }

    /// Build a minimal PermitTransferFrom for `amount` USDC.
    function _buildPermit(uint256 amount) internal view returns (PermitTransferFrom memory) {
        return PermitTransferFrom({
            permitted: TokenPermissions({token: address(usdc), amount: amount}),
            nonce: 0,
            deadline: block.timestamp + 1 hours
        });
    }

    /// Build a PermitTransferFrom for `amount` USDC used in createOrder.
    /// The contract computes the witness hash and passes it as a separate bytes32 to Permit2.
    function _buildWitnessPermit(uint256 amount) internal view returns (PermitTransferFrom memory) {
        return PermitTransferFrom({
            permitted: TokenPermissions({token: address(usdc), amount: amount}),
            nonce: 0,
            deadline: block.timestamp + 1 hours
        });
    }

    /// Compute the expected witness hash that the router will produce.
    function _expectedWitness(
        bytes32 orderId,
        address billerId_,
        bytes32 accountHash,
        bytes32 ref
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(router.BILL_ORDER_WITNESS_TYPEHASH(), orderId, billerId_, accountHash, ref));
    }

    bytes internal constant DUMMY_SIG = hex"deadbeef";
}
