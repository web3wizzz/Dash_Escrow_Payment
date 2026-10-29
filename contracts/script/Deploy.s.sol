// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {HandleRegistry} from "../HandleRegistry.sol";
import {KycRegistry}    from "../KycRegistry.sol";
import {PayRouter, InitialBiller} from "../PayRouter.sol";
import {ScheduledPayouts} from "../ScheduledPayouts.sol";

/**
 * @title Deploy
 * @notice Deploys all four Dash contracts in dependency order:
 *         HandleRegistry → KycRegistry → PayRouter → ScheduledPayouts
 *
 * Role-transfer pattern (deployer != admin):
 *   1. All four contracts are deployed with msg.sender as initialAdmin so the
 *      deployer can call grantRole during setup.
 *   2. All operational roles (OPERATOR, VERIFIER, PAUSER) are granted to their
 *      designated wallets.
 *   3. DEFAULT_ADMIN_ROLE is granted to the designated admin wallet on every
 *      contract.
 *   4. DEFAULT_ADMIN_ROLE is renounced from msg.sender on every contract.
 *      After this point the deployer has zero administrative power.
 *
 *   Important: msg.sender never holds OPERATOR_ROLE, VERIFIER_ROLE, or
 *   PAUSER_ROLE; it temporarily holds DEFAULT_ADMIN_ROLE only to call
 *   grantRole, not to move any funds. Renounce is the last step.
 *
 * Usage (dry-run, no broadcast):
 *   forge script contracts/script/Deploy.s.sol --rpc-url $RPC_URL
 *
 * Usage (Arc testnet broadcast):
 *   forge script contracts/script/Deploy.s.sol \
 *     --rpc-url https://rpc.testnet.arc.io \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast
 *
 * Required environment variables:
 *   DEPLOY_ADMIN_ADDRESS    - multisig or hardware wallet; receives DEFAULT_ADMIN_ROLE
 *   DEPLOY_OPERATOR_ADDRESS - backend hot wallet; receives OPERATOR_ROLE on PayRouter
 *   DEPLOY_VERIFIER_ADDRESS - KYC verifier; receives VERIFIER_ROLE on KycRegistry
 *   DEPLOY_PAUSER_ADDRESS   - receives PAUSER_ROLE on PayRouter and ScheduledPayouts
 *
 * Optional (defaults used if absent):
 *   DEPLOY_USDC_ADDRESS         - USDC ERC-20 (default: Arc canonical)
 *   DEPLOY_PERMIT2_ADDRESS      - Permit2 (default: canonical)
 *   DEPLOY_FEE_WALLET_ADDRESS   - fee wallet (default: DEPLOY_ADMIN_ADDRESS)
 *   DEPLOY_BILLER_ADDRESS       - initial biller (default: DEPLOY_OPERATOR_ADDRESS)
 *   DEPLOY_BILLER_TREASURY      - initial biller treasury (default: DEPLOY_ADMIN_ADDRESS)
 *
 * After deployment, paste the printed VITE_* lines into .env and restart the dev server.
 */
contract Deploy is Script {
    // ── Arc canonical addresses ───────────────────────────────────────────────
    address internal constant ARC_USDC        = 0x3600000000000000000000000000000000000000;
    address internal constant CANONICAL_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // ── Tier limits (6-decimal USDC ERC-20 units) ────────────────────────────
    // USDC on Arc uses 6 decimals for ERC-20 transfers and approvals.
    // The native (gas) view uses 18 decimals, but all application-level
    // amounts (transfer, approve, permit2) use 6. Do not mix decimal views.
    uint96 internal constant T0_PER_PAYMENT = 5_000_000;       //      5 USDC
    uint96 internal constant T0_DAILY       = 50_000_000;      //     50 USDC
    uint96 internal constant T1_PER_PAYMENT = 100_000_000;     //    100 USDC
    uint96 internal constant T1_DAILY       = 20_000_000_000;  // 20,000 USDC  ← corrected (was 20_000_000_000_000)
    uint96 internal constant T2_PER_PAYMENT = 20_000_000_000;  // 20,000 USDC per payment for Tier 2
    uint96 internal constant T2_DAILY       = 0;               // unlimited (0 = no cap)
    uint96 internal constant GLOBAL_CAP      = 25_000_000;      //     25 USDC global ceiling (all wallets)
    // MIN_BILL_TIER = 0: escrow is permissionless at launch.
    // The minBillTier config key is retained for future governance; set to 0 here
    // so any wallet can create an escrow order without identity verification.
    uint8  internal constant MIN_BILL_TIER   = 0;
    uint32 internal constant ORDER_TIMEOUT   = 1800;            // 30 minutes
    uint16 internal constant INITIAL_FEE_BPS = 0;              // 0% fee at launch

    function run() external {
        // ── Read required env vars ────────────────────────────────────────────
        address admin    = vm.envAddress("DEPLOY_ADMIN_ADDRESS");
        address operator = vm.envAddress("DEPLOY_OPERATOR_ADDRESS");
        address verifier = vm.envAddress("DEPLOY_VERIFIER_ADDRESS");
        address pauser   = vm.envAddress("DEPLOY_PAUSER_ADDRESS");

        // ── Optional env vars with sensible defaults ──────────────────────────
        address usdcAddr       = vm.envOr("DEPLOY_USDC_ADDRESS",       ARC_USDC);
        address permit2Addr    = vm.envOr("DEPLOY_PERMIT2_ADDRESS",    CANONICAL_PERMIT2);
        address feeWallet      = vm.envOr("DEPLOY_FEE_WALLET_ADDRESS", admin);
        address billerAddr     = vm.envOr("DEPLOY_BILLER_ADDRESS",     operator);
        address billerTreasury = vm.envOr("DEPLOY_BILLER_TREASURY",   admin);

        require(admin    != address(0), "DEPLOY_ADMIN_ADDRESS not set");
        require(operator != address(0), "DEPLOY_OPERATOR_ADDRESS not set");
        require(verifier != address(0), "DEPLOY_VERIFIER_ADDRESS not set");
        require(pauser   != address(0), "DEPLOY_PAUSER_ADDRESS not set");
        require(feeWallet != address(0), "DEPLOY_FEE_WALLET_ADDRESS resolved to zero");

        // ── Warn when deployer == admin ───────────────────────────────────────
        // When admin == msg.sender the grant-then-renounce pattern collapses:
        // grantRole(admin, admin) is a no-op (already held), and then
        // renounceRole(admin, msg.sender) removes the ONLY admin holder,
        // leaving every contract permanently adminless.
        // We detect this at startup and skip the renounce step in that case.
        // On testnet this is acceptable; on mainnet the deployer and admin
        // MUST be separate wallets (deployer = hot key, admin = multisig).
        bool deployerIsAdmin = (msg.sender == admin);

        console2.log("=== Dash deploy ===");
        if (deployerIsAdmin) {
            console2.log("WARNING: deployer == admin. Admin role will NOT be renounced from deployer.");
            console2.log("         Acceptable for testnet. Use separate wallets on mainnet.");
        } else {
            console2.log("Deployer (msg.sender): will hand off admin after setup");
        }
        console2.log("Admin (final):  ", admin);
        console2.log("Operator:       ", operator);
        console2.log("Verifier:       ", verifier);
        console2.log("Pauser:         ", pauser);
        console2.log("FeeWallet:      ", feeWallet);
        console2.log("USDC:           ", usdcAddr);
        console2.log("Permit2:        ", permit2Addr);

        vm.startBroadcast();

        // ── 1. HandleRegistry ─────────────────────────────────────────────────
        // Deployer (msg.sender) is initialAdmin so it can call grantRole below.
        bytes32[] memory reserved = new bytes32[](3);
        reserved[0] = keccak256(bytes("dash"));
        reserved[1] = keccak256(bytes("admin"));
        reserved[2] = keccak256(bytes("support"));

        HandleRegistry handleReg = new HandleRegistry(msg.sender, reserved);
        console2.log("HandleRegistry: ", address(handleReg));

        // ── 2. KycRegistry ────────────────────────────────────────────────────
        KycRegistry kycReg = new KycRegistry(msg.sender);
        console2.log("KycRegistry:    ", address(kycReg));

        // ── 3. PayRouter ──────────────────────────────────────────────────────
        InitialBiller[] memory initialBillers = new InitialBiller[](1);
        initialBillers[0] = InitialBiller({biller: billerAddr, treasury: billerTreasury});

        PayRouter router = new PayRouter(
            usdcAddr,
            address(kycReg),
            address(handleReg),
            permit2Addr,
            msg.sender,   // initialAdmin — deployer, so grantRole calls succeed
            feeWallet,    // explicit fee recipient, NOT tied to initialAdmin
            PayRouter.TierConfig({perPaymentCap: T0_PER_PAYMENT, dailyCap: T0_DAILY}),
            PayRouter.TierConfig({perPaymentCap: T1_PER_PAYMENT, dailyCap: T1_DAILY}),
            PayRouter.TierConfig({perPaymentCap: T2_PER_PAYMENT, dailyCap: T2_DAILY}),
            GLOBAL_CAP,
            MIN_BILL_TIER,
            ORDER_TIMEOUT,
            INITIAL_FEE_BPS,
            initialBillers
        );
        console2.log("PayRouter:      ", address(router));

        // ── 4. ScheduledPayouts ───────────────────────────────────────────────
        ScheduledPayouts sp = new ScheduledPayouts(
            usdcAddr,
            permit2Addr,
            msg.sender,
            address(kycReg),
            GLOBAL_CAP,
            T0_PER_PAYMENT,
            T1_PER_PAYMENT,
            T2_PER_PAYMENT
        );
        console2.log("ScheduledPayouts:", address(sp));

        // ── Grant operational roles ───────────────────────────────────────────
        // Deployer holds DEFAULT_ADMIN_ROLE on all four contracts (granted in
        // constructors above), so these grantRole calls succeed regardless of
        // whether admin == msg.sender or not.

        kycReg.grantRole(kycReg.VERIFIER_ROLE(), verifier);

        router.grantRole(router.OPERATOR_ROLE(), operator);
        router.grantRole(router.PAUSER_ROLE(),   pauser);

        sp.grantRole(sp.PAUSER_ROLE(), pauser);

        // ── Transfer DEFAULT_ADMIN_ROLE to designated admin ───────────────────
        // When deployer == admin this grantRole is a no-op (already held).
        // When deployer != admin this grants a second admin holder before we renounce.
        handleReg.grantRole(handleReg.DEFAULT_ADMIN_ROLE(), admin);
        kycReg.grantRole(kycReg.DEFAULT_ADMIN_ROLE(),       admin);
        router.grantRole(router.DEFAULT_ADMIN_ROLE(),       admin);
        sp.grantRole(sp.DEFAULT_ADMIN_ROLE(),               admin);

        // ── Revoke all deployer roles (only when deployer != admin) ──────────
        // When deployer == admin: DO NOT renounce. The deployer IS the admin;
        // renouncing would leave every contract permanently adminless.
        // When deployer != admin: renounce DEFAULT_ADMIN_ROLE and PAUSER_ROLE
        // from the deployer so it ends with zero roles on every contract.
        if (!deployerIsAdmin) {
            handleReg.renounceRole(handleReg.DEFAULT_ADMIN_ROLE(), msg.sender);
            kycReg.renounceRole(kycReg.DEFAULT_ADMIN_ROLE(),       msg.sender);
            // PayRouter grants DEFAULT_ADMIN_ROLE + PAUSER_ROLE to initialAdmin
            router.renounceRole(router.PAUSER_ROLE(),          msg.sender);
            router.renounceRole(router.DEFAULT_ADMIN_ROLE(),   msg.sender);
            // ScheduledPayouts grants DEFAULT_ADMIN_ROLE + PAUSER_ROLE to initialAdmin
            sp.renounceRole(sp.PAUSER_ROLE(),          msg.sender);
            sp.renounceRole(sp.DEFAULT_ADMIN_ROLE(),   msg.sender);
        }
        // Note: when deployer == admin, deployer retains DEFAULT_ADMIN_ROLE and
        // PAUSER_ROLE. This is expected — the deployer IS the designated admin.

        vm.stopBroadcast();

        // ── Print .env lines ──────────────────────────────────────────────────
        console2.log("");
        console2.log("=== Add these to .env and restart the dev server ===");
        console2.log(string(abi.encodePacked("VITE_HANDLE_REGISTRY_ADDRESS=",   _toHex(address(handleReg)))));
        console2.log(string(abi.encodePacked("VITE_KYC_REGISTRY_ADDRESS=",      _toHex(address(kycReg)))));
        console2.log(string(abi.encodePacked("VITE_PAY_ROUTER_ADDRESS=",        _toHex(address(router)))));
        console2.log(string(abi.encodePacked("VITE_SCHEDULED_PAYOUTS_ADDRESS=", _toHex(address(sp)))));
        console2.log(string(abi.encodePacked("VITE_FEE_WALLET_ADDRESS=",        _toHex(feeWallet))));
        console2.log("");
        if (deployerIsAdmin) {
            console2.log("NOTE: deployer == admin. Admin retains DEFAULT_ADMIN_ROLE + PAUSER_ROLE.");
            console2.log("      Use separate wallets on mainnet.");
        } else {
            console2.log("NOTE: Deployer has zero roles on all contracts after this deploy.");
        }
    }

    /// @dev Convert address to "0x..." hex string for console output.
    function _toHex(address addr) internal pure returns (string memory) {
        bytes memory b = abi.encodePacked(addr);
        bytes memory hex_ = new bytes(42);
        hex_[0] = '0'; hex_[1] = 'x';
        bytes memory _hexChars = "0123456789abcdef";
        for (uint256 i = 0; i < 20; i++) {
            hex_[2 + i * 2]     = _hexChars[uint8(b[i]) >> 4];
            hex_[2 + i * 2 + 1] = _hexChars[uint8(b[i]) & 0x0f];
        }
        return string(hex_);
    }
}
