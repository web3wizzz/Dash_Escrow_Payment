// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {HandleRegistry} from "../HandleRegistry.sol";
import {KycRegistry}    from "../KycRegistry.sol";
import {PayRouter, InitialBiller} from "../PayRouter.sol";
import {ScheduledPayouts} from "../ScheduledPayouts.sol";

/**
 * @title Deploy
 * @notice Deploys all four Dash contracts in dependency order:
 *         HandleRegistry → KycRegistry → PayRouter → ScheduledPayouts
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
 * Usage (Arc mainnet — requires explicit approval, review before running):
 *   forge script contracts/script/Deploy.s.sol \
 *     --rpc-url https://rpc.mainnet.arc.io \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast
 *
 * Required environment variables:
 *   DEPLOY_ADMIN_ADDRESS   - multisig or hardware wallet; receives DEFAULT_ADMIN_ROLE on all contracts
 *   DEPLOY_OPERATOR_ADDRESS - backend hot wallet; receives OPERATOR_ROLE on PayRouter
 *   DEPLOY_VERIFIER_ADDRESS - KYC verifier; receives VERIFIER_ROLE on KycRegistry
 *   DEPLOY_PAUSER_ADDRESS  - receives PAUSER_ROLE on PayRouter and ScheduledPayouts
 *
 * Optional (defaults used if absent):
 *   DEPLOY_USDC_ADDRESS    - USDC ERC-20 (default: Arc canonical 0x3600...0000)
 *   DEPLOY_PERMIT2_ADDRESS - Permit2 (default: canonical 0x000000000022D473030F116dDEE9F6B43aC78BA3)
 *   DEPLOY_FEE_WALLET_ADDRESS - fee wallet (default: DEPLOY_ADMIN_ADDRESS)
 *   DEPLOY_BILLER_ADDRESS  - initial biller (default: DEPLOY_OPERATOR_ADDRESS)
 *   DEPLOY_BILLER_TREASURY - initial biller treasury (default: DEPLOY_ADMIN_ADDRESS)
 *
 * After deployment, paste the printed VITE_* lines into .env and restart the dev server.
 */
contract Deploy is Script {
    // ── Arc canonical addresses ───────────────────────────────────
    address internal constant ARC_USDC    = 0x3600000000000000000000000000000000000000;
    address internal constant CANONICAL_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // ── Tier limits (6-decimal USDC) ──────────────────────────────
    uint96 internal constant T0_PER_PAYMENT = 5_000_000;           // 5 USDC
    uint96 internal constant T0_DAILY       = 50_000_000;          // 50 USDC
    uint96 internal constant T1_PER_PAYMENT = 100_000_000;         // 100 USDC
    uint96 internal constant T1_DAILY       = 20_000_000_000_000;  // effectively unlimited
    uint96 internal constant T2_PER_PAYMENT = 20_000_000_000_000;  // effectively unlimited
    uint96 internal constant T2_DAILY       = 0;                   // unlimited (0 = no cap)
    uint96 internal constant GLOBAL_CAP     = 25_000_000;          // 25 USDC global ceiling
    uint8  internal constant MIN_BILL_TIER  = 1;
    uint32 internal constant ORDER_TIMEOUT  = 1800;                 // 30 minutes
    uint16 internal constant INITIAL_FEE_BPS = 0;                  // 0% fee at launch

    function run() external {
        // ── Read required env vars ────────────────────────────────
        address admin    = vm.envAddress("DEPLOY_ADMIN_ADDRESS");
        address operator = vm.envAddress("DEPLOY_OPERATOR_ADDRESS");
        address verifier = vm.envAddress("DEPLOY_VERIFIER_ADDRESS");
        address pauser   = vm.envAddress("DEPLOY_PAUSER_ADDRESS");

        // ── Optional env vars with sensible defaults ──────────────
        address usdcAddr    = vm.envOr("DEPLOY_USDC_ADDRESS",    ARC_USDC);
        address permit2Addr = vm.envOr("DEPLOY_PERMIT2_ADDRESS", CANONICAL_PERMIT2);
        address feeWallet   = vm.envOr("DEPLOY_FEE_WALLET_ADDRESS", admin);
        address billerAddr  = vm.envOr("DEPLOY_BILLER_ADDRESS",  operator);
        address billerTreasury = vm.envOr("DEPLOY_BILLER_TREASURY", admin);

        require(admin    != address(0), "DEPLOY_ADMIN_ADDRESS not set");
        require(operator != address(0), "DEPLOY_OPERATOR_ADDRESS not set");
        require(verifier != address(0), "DEPLOY_VERIFIER_ADDRESS not set");
        require(pauser   != address(0), "DEPLOY_PAUSER_ADDRESS not set");

        console2.log("=== Dash deploy ===");
        console2.log("Admin:    ", admin);
        console2.log("Operator: ", operator);
        console2.log("Verifier: ", verifier);
        console2.log("Pauser:   ", pauser);
        console2.log("USDC:     ", usdcAddr);
        console2.log("Permit2:  ", permit2Addr);

        vm.startBroadcast();

        // ── 1. HandleRegistry ─────────────────────────────────────
        bytes32[] memory reserved = new bytes32[](3);
        reserved[0] = keccak256(bytes("dash"));
        reserved[1] = keccak256(bytes("admin"));
        reserved[2] = keccak256(bytes("support"));

        HandleRegistry handleReg = new HandleRegistry(admin, reserved);
        console2.log("HandleRegistry:", address(handleReg));

        // ── 2. KycRegistry ────────────────────────────────────────
        KycRegistry kycReg = new KycRegistry(admin);

        // Grant VERIFIER_ROLE to the verifier wallet
        bytes32 verifierRole = kycReg.VERIFIER_ROLE();
        kycReg.grantRole(verifierRole, verifier);
        console2.log("KycRegistry:   ", address(kycReg));

        // ── 3. PayRouter ──────────────────────────────────────────
        InitialBiller[] memory initialBillers = new InitialBiller[](1);
        initialBillers[0] = InitialBiller({biller: billerAddr, treasury: billerTreasury});

        PayRouter router = new PayRouter(
            usdcAddr,
            address(kycReg),
            address(handleReg),
            permit2Addr,
            admin,
            PayRouter.TierConfig({perPaymentCap: T0_PER_PAYMENT, dailyCap: T0_DAILY}),
            PayRouter.TierConfig({perPaymentCap: T1_PER_PAYMENT, dailyCap: T1_DAILY}),
            PayRouter.TierConfig({perPaymentCap: T2_PER_PAYMENT, dailyCap: T2_DAILY}),
            GLOBAL_CAP,
            MIN_BILL_TIER,
            ORDER_TIMEOUT,
            INITIAL_FEE_BPS,
            initialBillers
        );

        // Grant OPERATOR_ROLE and PAUSER_ROLE
        bytes32 operatorRole = router.OPERATOR_ROLE();
        bytes32 pauserRole   = router.PAUSER_ROLE();
        router.grantRole(operatorRole, operator);
        router.grantRole(pauserRole,   pauser);

        // Transfer feeWallet if different from admin
        // (feeWallet is set to initialAdmin in constructor; queue a change via timelock if needed)
        // Note: feeWallet can only be changed via timelocked queueConfigChange after deploy.

        console2.log("PayRouter:     ", address(router));

        // ── 4. ScheduledPayouts ───────────────────────────────────
        ScheduledPayouts sp = new ScheduledPayouts(
            usdcAddr,
            permit2Addr,
            admin,
            address(kycReg),
            GLOBAL_CAP,
            T0_PER_PAYMENT,
            T1_PER_PAYMENT,
            T2_PER_PAYMENT
        );

        // Grant PAUSER_ROLE on ScheduledPayouts
        bytes32 spPauserRole = sp.PAUSER_ROLE();
        sp.grantRole(spPauserRole, pauser);

        console2.log("ScheduledPayouts:", address(sp));

        vm.stopBroadcast();

        // ── Print .env lines ──────────────────────────────────────
        console2.log("");
        console2.log("=== Add these to .env and restart the dev server ===");
        console2.log(string(abi.encodePacked("VITE_HANDLE_REGISTRY_ADDRESS=",  _toHex(address(handleReg)))));
        console2.log(string(abi.encodePacked("VITE_KYC_REGISTRY_ADDRESS=",     _toHex(address(kycReg)))));
        console2.log(string(abi.encodePacked("VITE_PAY_ROUTER_ADDRESS=",       _toHex(address(router)))));
        console2.log(string(abi.encodePacked("VITE_SCHEDULED_PAYOUTS_ADDRESS=",_toHex(address(sp)))));
        console2.log(string(abi.encodePacked("VITE_FEE_WALLET_ADDRESS=",       _toHex(feeWallet))));
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
