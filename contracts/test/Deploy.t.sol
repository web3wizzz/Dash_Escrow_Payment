// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {Script} from "forge-std/Script.sol";
import {MockERC20}       from "../test-helpers/MockERC20.sol";
import {MockPermit2}     from "../test-helpers/MockPermit2.sol";
import {HandleRegistry}  from "../HandleRegistry.sol";
import {KycRegistry}     from "../KycRegistry.sol";
import {PayRouter, InitialBiller} from "../PayRouter.sol";
import {ScheduledPayouts} from "../ScheduledPayouts.sol";

/**
 * @title DeployTest
 * @notice Verifies the Deploy script logic inline (without forge-script vm.broadcast)
 *         using five entirely separate addresses:
 *           deployer  — the wallet that signs the deployment txs
 *           admin     — receives DEFAULT_ADMIN_ROLE; the final governance wallet
 *           operator  — OPERATOR_ROLE on PayRouter
 *           verifier  — VERIFIER_ROLE on KycRegistry
 *           pauser    — PAUSER_ROLE on PayRouter + ScheduledPayouts
 *
 * Invariants verified:
 *   POST-DEPLOY (after role transfer + renounce):
 *   1. deployer has DEFAULT_ADMIN_ROLE on NO contract.
 *   2. admin    has DEFAULT_ADMIN_ROLE on ALL four contracts.
 *   3. operator has OPERATOR_ROLE on PayRouter only.
 *   4. verifier has VERIFIER_ROLE on KycRegistry only.
 *   5. pauser   has PAUSER_ROLE on PayRouter AND ScheduledPayouts.
 *   6. deployer has PAUSER_ROLE on NO contract.
 *   7. deployer does not have OPERATOR_ROLE, VERIFIER_ROLE.
 *   8. No funds-control power was ever granted to deployer
 *      (OPERATOR_ROLE is the only role that can move bill escrow funds;
 *       deployer never held it).
 */
contract DeployTest is Test {
    // ── five separate actor addresses ──────────────────────────────
    address internal deployer = makeAddr("deployer");
    address internal admin    = makeAddr("admin");
    address internal operator = makeAddr("operator");
    address internal verifier = makeAddr("verifier");
    address internal pauser   = makeAddr("pauser");

    // ── contracts ──────────────────────────────────────────────────
    MockERC20       internal usdc;
    MockPermit2     internal permit2;
    HandleRegistry  internal handleReg;
    KycRegistry     internal kycReg;
    PayRouter       internal router;
    ScheduledPayouts internal sp;

    // ── cap constants (mirrors Deploy.s.sol) ───────────────────────
    uint96 internal constant T0_PER  = 5_000_000;
    uint96 internal constant T0_DAY  = 50_000_000;
    uint96 internal constant T1_PER  = 100_000_000;
    uint96 internal constant T1_DAY  = 20_000_000_000;
    uint96 internal constant T2_PER  = 20_000_000_000;
    uint96 internal constant T2_DAY  = 0;
    uint96 internal constant GCAP    = 25_000_000;

    // ── fee wallet ─────────────────────────────────────────────────
    address internal feeWallet = makeAddr("feeWallet");

    function setUp() public {
        usdc    = new MockERC20("USDC", "USDC", 6);
        permit2 = new MockPermit2(false);

        // ── Execute as deployer (mirrors vm.startBroadcast in script) ──
        vm.startPrank(deployer);

        // 1. HandleRegistry — deployer as initialAdmin
        bytes32[] memory reserved = new bytes32[](2);
        reserved[0] = keccak256(bytes("dash"));
        reserved[1] = keccak256(bytes("admin"));
        handleReg = new HandleRegistry(deployer, reserved);

        // 2. KycRegistry — deployer as initialAdmin
        kycReg = new KycRegistry(deployer);

        // 3. PayRouter — deployer as initialAdmin
        InitialBiller[] memory billers = new InitialBiller[](1);
        billers[0] = InitialBiller({biller: operator, treasury: admin});

        router = new PayRouter(
            address(usdc),
            address(kycReg),
            address(handleReg),
            address(permit2),
            deployer,    // initialAdmin
            feeWallet,   // explicit fee wallet
            PayRouter.TierConfig({perPaymentCap: T0_PER, dailyCap: T0_DAY}),
            PayRouter.TierConfig({perPaymentCap: T1_PER, dailyCap: T1_DAY}),
            PayRouter.TierConfig({perPaymentCap: T2_PER, dailyCap: T2_DAY}),
            GCAP,
            uint8(1),
            uint32(1800),
            uint16(0),
            billers
        );

        // 4. ScheduledPayouts — deployer as initialAdmin
        sp = new ScheduledPayouts(
            address(usdc),
            address(permit2),
            deployer,
            address(kycReg),
            GCAP,
            T0_PER,
            T1_PER,
            T2_PER
        );

        // ── Grant operational roles (deployer has DEFAULT_ADMIN_ROLE) ──
        kycReg.grantRole(kycReg.VERIFIER_ROLE(), verifier);
        router.grantRole(router.OPERATOR_ROLE(), operator);
        router.grantRole(router.PAUSER_ROLE(),   pauser);
        sp.grantRole(sp.PAUSER_ROLE(),           pauser);

        // ── Transfer DEFAULT_ADMIN_ROLE to admin ───────────────────
        handleReg.grantRole(handleReg.DEFAULT_ADMIN_ROLE(), admin);
        kycReg.grantRole(kycReg.DEFAULT_ADMIN_ROLE(),       admin);
        router.grantRole(router.DEFAULT_ADMIN_ROLE(),       admin);
        sp.grantRole(sp.DEFAULT_ADMIN_ROLE(),               admin);

        // ── Renounce all deployer roles from deployer ──────────────
        // Constructors grant DEFAULT_ADMIN_ROLE + PAUSER_ROLE to initialAdmin.
        // Revoke both so the deployer ends with zero roles.
        handleReg.renounceRole(handleReg.DEFAULT_ADMIN_ROLE(), deployer);
        kycReg.renounceRole(kycReg.DEFAULT_ADMIN_ROLE(),       deployer);
        router.renounceRole(router.PAUSER_ROLE(),   deployer);
        router.renounceRole(router.DEFAULT_ADMIN_ROLE(), deployer);
        sp.renounceRole(sp.PAUSER_ROLE(),   deployer);
        sp.renounceRole(sp.DEFAULT_ADMIN_ROLE(), deployer);

        vm.stopPrank();
    }

    // ── Invariant 1: deployer has DEFAULT_ADMIN_ROLE on no contract ──

    function test_Deployer_HasNoAdminRole_HandleRegistry() public view {
        assertFalse(
            handleReg.hasRole(handleReg.DEFAULT_ADMIN_ROLE(), deployer),
            "deployer should NOT have DEFAULT_ADMIN_ROLE on HandleRegistry"
        );
    }

    function test_Deployer_HasNoAdminRole_KycRegistry() public view {
        assertFalse(
            kycReg.hasRole(kycReg.DEFAULT_ADMIN_ROLE(), deployer),
            "deployer should NOT have DEFAULT_ADMIN_ROLE on KycRegistry"
        );
    }

    function test_Deployer_HasNoAdminRole_PayRouter() public view {
        assertFalse(
            router.hasRole(router.DEFAULT_ADMIN_ROLE(), deployer),
            "deployer should NOT have DEFAULT_ADMIN_ROLE on PayRouter"
        );
    }

    function test_Deployer_HasNoAdminRole_ScheduledPayouts() public view {
        assertFalse(
            sp.hasRole(sp.DEFAULT_ADMIN_ROLE(), deployer),
            "deployer should NOT have DEFAULT_ADMIN_ROLE on ScheduledPayouts"
        );
    }

    // ── Invariant 2: admin has DEFAULT_ADMIN_ROLE on all contracts ──

    function test_Admin_HasAdminRole_AllContracts() public view {
        assertTrue(handleReg.hasRole(handleReg.DEFAULT_ADMIN_ROLE(), admin), "admin: HandleRegistry");
        assertTrue(kycReg.hasRole(kycReg.DEFAULT_ADMIN_ROLE(),       admin), "admin: KycRegistry");
        assertTrue(router.hasRole(router.DEFAULT_ADMIN_ROLE(),       admin), "admin: PayRouter");
        assertTrue(sp.hasRole(sp.DEFAULT_ADMIN_ROLE(),               admin), "admin: ScheduledPayouts");
    }

    // ── Invariant 3: operator has OPERATOR_ROLE on PayRouter only ──

    function test_Operator_HasOperatorRole_PayRouter() public view {
        assertTrue(
            router.hasRole(router.OPERATOR_ROLE(), operator),
            "operator should have OPERATOR_ROLE on PayRouter"
        );
    }

    function test_Deployer_HasNo_OperatorRole() public view {
        assertFalse(
            router.hasRole(router.OPERATOR_ROLE(), deployer),
            "deployer should NOT have OPERATOR_ROLE"
        );
    }

    // ── Invariant 4: verifier has VERIFIER_ROLE on KycRegistry ──────

    function test_Verifier_HasVerifierRole_KycRegistry() public view {
        assertTrue(
            kycReg.hasRole(kycReg.VERIFIER_ROLE(), verifier),
            "verifier should have VERIFIER_ROLE on KycRegistry"
        );
    }

    function test_Deployer_HasNo_VerifierRole() public view {
        assertFalse(
            kycReg.hasRole(kycReg.VERIFIER_ROLE(), deployer),
            "deployer should NOT have VERIFIER_ROLE"
        );
    }

    // ── Invariant 5: pauser has PAUSER_ROLE on PayRouter + ScheduledPayouts ──

    function test_Pauser_HasPauserRole_PayRouter() public view {
        assertTrue(
            router.hasRole(router.PAUSER_ROLE(), pauser),
            "pauser should have PAUSER_ROLE on PayRouter"
        );
    }

    function test_Pauser_HasPauserRole_ScheduledPayouts() public view {
        assertTrue(
            sp.hasRole(sp.PAUSER_ROLE(), pauser),
            "pauser should have PAUSER_ROLE on ScheduledPayouts"
        );
    }

    // ── Invariant 6: deployer has PAUSER_ROLE on no contract ────────

    function test_Deployer_HasNo_PauserRole_PayRouter() public view {
        assertFalse(
            router.hasRole(router.PAUSER_ROLE(), deployer),
            "deployer should NOT have PAUSER_ROLE on PayRouter"
        );
    }

    function test_Deployer_HasNo_PauserRole_ScheduledPayouts() public view {
        assertFalse(
            sp.hasRole(sp.PAUSER_ROLE(), deployer),
            "deployer should NOT have PAUSER_ROLE on ScheduledPayouts"
        );
    }

    // ── Invariant 7: deployer has no roles at all post-renounce ─────

    function test_Deployer_HasNoRoles_PostDeploy() public view {
        // Deployer must have zero roles on every contract after setup.
        assertFalse(router.hasRole(router.DEFAULT_ADMIN_ROLE(), deployer), "deployer: no DEFAULT_ADMIN on router");
        assertFalse(router.hasRole(router.OPERATOR_ROLE(),      deployer), "deployer: no OPERATOR on router");
        assertFalse(router.hasRole(router.PAUSER_ROLE(),        deployer), "deployer: no PAUSER on router");
        assertFalse(sp.hasRole(sp.DEFAULT_ADMIN_ROLE(),         deployer), "deployer: no DEFAULT_ADMIN on sp");
        assertFalse(sp.hasRole(sp.PAUSER_ROLE(),                deployer), "deployer: no PAUSER on sp");
        assertFalse(kycReg.hasRole(kycReg.DEFAULT_ADMIN_ROLE(), deployer), "deployer: no DEFAULT_ADMIN on kycReg");
        assertFalse(kycReg.hasRole(kycReg.VERIFIER_ROLE(),      deployer), "deployer: no VERIFIER on kycReg");
        assertFalse(handleReg.hasRole(handleReg.DEFAULT_ADMIN_ROLE(), deployer), "deployer: no DEFAULT_ADMIN on handleReg");
    }

    // ── Invariant 8: admin can queue config changes (controls timelock) ──

    function test_Admin_CanQueueConfigChange() public {
        bytes32 changeFeeKey = keccak256("feeBps");
        bytes memory encoded = abi.encode(uint16(50));
        vm.prank(admin);
        router.queueConfigChange(changeFeeKey, encoded);
        (, bytes memory queued) = router.getPendingChange(changeFeeKey);
        assertEq(keccak256(queued), keccak256(encoded), "queued change mismatch");
    }

    // ── Tier cap correctness ─────────────────────────────────────────

    function test_TierCaps_Correct() public view {
        (uint96 t0Per, uint96 t0Day) = _getTierConfig(0);
        (uint96 t1Per, uint96 t1Day) = _getTierConfig(1);
        (uint96 t2Per,            ) = _getTierConfig(2);

        assertEq(t0Per,   5_000_000,    "T0 per-payment");
        assertEq(t0Day,  50_000_000,    "T0 daily");
        assertEq(t1Per, 100_000_000,    "T1 per-payment");
        assertEq(t1Day,  20_000_000_000, "T1 daily = 20,000 USDC");
        assertEq(t2Per,  20_000_000_000, "T2 per-payment = 20,000 USDC");
        assertEq(router.globalPerPaymentCap(), 25_000_000, "global cap = 25 USDC");
    }

    function _getTierConfig(uint8 tier) internal view returns (uint96 perPayment, uint96 daily) {
        (uint96 p, uint96 d) = router.tierConfigs(tier);
        return (p, d);
    }

    // ── Invariant 9: feeWallet is set to the explicit feeWallet arg, not deployer ──

    function test_FeeWallet_IsExplicitParam_NotDeployer() public view {
        assertEq(router.feeWallet(), feeWallet, "feeWallet should match explicit constructor arg");
        assertTrue(router.feeWallet() != deployer, "feeWallet must NOT be the deployer");
    }

    function test_FeeWallet_IsExplicitParam_NotAdmin() public view {
        // feeWallet is a distinct address from admin and deployer
        assertEq(router.feeWallet(), feeWallet, "feeWallet should match explicit constructor arg");
        assertTrue(router.feeWallet() != admin, "feeWallet should NOT default to admin");
    }

    // ── Zero address constructor guards ──────────────────────────────────

    function test_RevertConstructor_ZeroFeeWallet() public {
        InitialBiller[] memory billers = new InitialBiller[](0);
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        new PayRouter(
            address(usdc),
            address(kycReg),
            address(handleReg),
            address(permit2),
            deployer,       // initialAdmin
            address(0),     // feeWallet_ = zero → should revert
            PayRouter.TierConfig({perPaymentCap: T0_PER, dailyCap: T0_DAY}),
            PayRouter.TierConfig({perPaymentCap: T1_PER, dailyCap: T1_DAY}),
            PayRouter.TierConfig({perPaymentCap: T2_PER, dailyCap: T2_DAY}),
            GCAP,
            uint8(1),
            uint32(1800),
            uint16(0),
            billers
        );
    }

    // ── admin == deployer: no role loss ─────────────────────────────────
    // Mirrors the testnet single-wallet case where DEPLOY_ADMIN_ADDRESS == deployer.

    function test_AdminEqualsDeployer_RetainsAdminRole() public {
        // Deploy all contracts with a single wallet acting as both deployer and admin.
        address singleWallet = makeAddr("singleWallet");
        address fw = makeAddr("fw2");
        MockERC20  u  = new MockERC20("U", "U", 6);
        MockPermit2 p2 = new MockPermit2(false);

        vm.startPrank(singleWallet);

        bytes32[] memory reserved = new bytes32[](0);
        HandleRegistry hr = new HandleRegistry(singleWallet, reserved);
        KycRegistry kr    = new KycRegistry(singleWallet);

        InitialBiller[] memory billers2 = new InitialBiller[](0);
        PayRouter r2 = new PayRouter(
            address(u), address(kr), address(hr), address(p2),
            singleWallet, fw,
            PayRouter.TierConfig({perPaymentCap: T0_PER, dailyCap: T0_DAY}),
            PayRouter.TierConfig({perPaymentCap: T1_PER, dailyCap: T1_DAY}),
            PayRouter.TierConfig({perPaymentCap: T2_PER, dailyCap: T2_DAY}),
            GCAP, uint8(1), uint32(1800), uint16(0), billers2
        );
        ScheduledPayouts sp2 = new ScheduledPayouts(
            address(u), address(p2), singleWallet, address(kr),
            GCAP, T0_PER, T1_PER, T2_PER
        );

        // Grant operational roles to self (acceptable on testnet)
        kr.grantRole(kr.VERIFIER_ROLE(),   singleWallet);
        r2.grantRole(r2.OPERATOR_ROLE(),   singleWallet);
        r2.grantRole(r2.PAUSER_ROLE(),     singleWallet);
        sp2.grantRole(sp2.PAUSER_ROLE(),   singleWallet);

        // Grant DEFAULT_ADMIN_ROLE to self — no-op since already held
        hr.grantRole(hr.DEFAULT_ADMIN_ROLE(),  singleWallet);
        kr.grantRole(kr.DEFAULT_ADMIN_ROLE(),  singleWallet);
        r2.grantRole(r2.DEFAULT_ADMIN_ROLE(),  singleWallet);
        sp2.grantRole(sp2.DEFAULT_ADMIN_ROLE(), singleWallet);

        // DO NOT renounce — singleWallet IS the admin.

        vm.stopPrank();

        // After setup: singleWallet must still hold DEFAULT_ADMIN_ROLE on all contracts.
        assertTrue(hr.hasRole(hr.DEFAULT_ADMIN_ROLE(),   singleWallet), "singleWallet: DEFAULT_ADMIN on handleReg");
        assertTrue(kr.hasRole(kr.DEFAULT_ADMIN_ROLE(),   singleWallet), "singleWallet: DEFAULT_ADMIN on kycReg");
        assertTrue(r2.hasRole(r2.DEFAULT_ADMIN_ROLE(),   singleWallet), "singleWallet: DEFAULT_ADMIN on router");
        assertTrue(sp2.hasRole(sp2.DEFAULT_ADMIN_ROLE(), singleWallet), "singleWallet: DEFAULT_ADMIN on sp");
        // And can still queue config changes (has not been locked out)
        bytes32 feeKey = keccak256("feeBps");
        vm.prank(singleWallet);
        r2.queueConfigChange(feeKey, abi.encode(uint16(10)));
        (, bytes memory queued) = r2.getPendingChange(feeKey);
        assertGt(queued.length, 0, "singleWallet should be able to queue config change");
    }

    // ── Duplicate role addresses: operator == admin ────────────────────
    // Some testnet setups reuse one wallet for operator + admin.
    // Verify the invariants still hold (no extra unexpected roles).

    function test_DuplicateRoles_OperatorEqualsAdmin_IsSafe() public {
        // Deploy a fresh set where operator == admin
        address multiRole = makeAddr("multiRole");
        address fw3 = makeAddr("fw3");
        MockERC20  u3  = new MockERC20("U3", "U3", 6);
        MockPermit2 p3 = new MockPermit2(false);

        vm.startPrank(multiRole);

        bytes32[] memory reserved = new bytes32[](0);
        HandleRegistry hr3 = new HandleRegistry(multiRole, reserved);
        KycRegistry kr3    = new KycRegistry(multiRole);

        InitialBiller[] memory billers3 = new InitialBiller[](0);
        PayRouter r3 = new PayRouter(
            address(u3), address(kr3), address(hr3), address(p3),
            multiRole, fw3,
            PayRouter.TierConfig({perPaymentCap: T0_PER, dailyCap: T0_DAY}),
            PayRouter.TierConfig({perPaymentCap: T1_PER, dailyCap: T1_DAY}),
            PayRouter.TierConfig({perPaymentCap: T2_PER, dailyCap: T2_DAY}),
            GCAP, uint8(1), uint32(1800), uint16(0), billers3
        );

        // Grant OPERATOR_ROLE to multiRole (same as admin)
        r3.grantRole(r3.OPERATOR_ROLE(), multiRole);

        vm.stopPrank();

        // multiRole holds both OPERATOR_ROLE and DEFAULT_ADMIN_ROLE — valid but intentional
        assertTrue(r3.hasRole(r3.DEFAULT_ADMIN_ROLE(), multiRole), "multiRole: DEFAULT_ADMIN");
        assertTrue(r3.hasRole(r3.OPERATOR_ROLE(),      multiRole), "multiRole: OPERATOR");
        // feeWallet is still the explicit param, not multiRole
        assertEq(r3.feeWallet(), fw3, "feeWallet is explicit param even when roles overlap");
    }
}
