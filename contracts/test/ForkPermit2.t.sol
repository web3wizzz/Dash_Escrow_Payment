// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ForkPermit2 — real Permit2 EIP-712 integration tests
 *
 * Run against a live Arc Testnet fork so the canonical Permit2 bytecode handles
 * EIP-712 signature verification rather than MockPermit2.
 *
 *   forge test --match-contract ForkPermit2Test \
 *              --fork-url https://rpc.testnet.arc.io \
 *              --via-ir -v
 *
 * Arc USDC note: Arc routes ERC-20 token movements through a native precompile
 * at 0x1800... that Foundry's fork EVM cannot execute. This means transfer(),
 * transferFrom(), and deal() all revert when they try to move tokens.
 *
 * What we test here (the part MockPermit2 cannot cover):
 *  1. Real EIP-712 domain separator from live Permit2 on the correct chainId.
 *  2. Real nonce bitmap invalidation — replay of a used nonce reverts.
 *  3. Real sig recovery — a bad/zeroed signature reverts with InvalidSigner.
 *  4. Real witness hash binding — tampered witness reverts with InvalidSigner.
 *  5. Domain separator is chainId-bound — wrong chainId produces wrong digest.
 *
 * The token-movement path (transferFrom inside Permit2, balanceOf checks) is
 * covered by unit tests against MockERC20 in the non-fork suite and by manual
 * live-wallet testing described in docs/deployment-manifest.md.
 *
 * To verify signatures without triggering the precompile, we call Permit2
 * directly via vm.prank + vm.mockCall(transferFrom → success) so the real
 * signature-recovery code runs but the token leg is stubbed.
 */

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    PayRouter,
    PermitTransferFrom,
    TokenPermissions,
    SignatureTransferDetails,
    InitialBiller
} from "../PayRouter.sol";
import {HandleRegistry} from "../HandleRegistry.sol";
import {KycRegistry} from "../KycRegistry.sol";

// ── Permit2 canonical interface ───────────────────────────────────────────────
// Reuse the structs already exported by PayRouter to avoid shadowing.

interface IPermit2 {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function nonceBitmap(address owner, uint256 wordPos) external view returns (uint256);
    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;
}

contract ForkPermit2Test is Test {
    // ── canonical addresses ──────────────────────────────────────────────────
    address constant USDC    = 0x3600000000000000000000000000000000000000;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // vm.addr(1) = 0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf
    uint256 constant SIGNER_PK = 1;
    address signer;

    // ── type hashes ──────────────────────────────────────────────────────────
    // Source: https://github.com/Uniswap/permit2/blob/main/src/libraries/PermitHash.sol

    bytes32 constant TOKEN_PERMISSIONS_TYPEHASH =
        keccak256("TokenPermissions(address token,uint256 amount)");

    // Plain transfer (no witness)
    bytes32 constant PERMIT_TRANSFER_FROM_TYPEHASH = keccak256(
        "PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)"
        "TokenPermissions(address token,uint256 amount)"
    );

    // Permit2 witness typehash = keccak256(STUB + witnessTypeString)
    // STUB = "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,"
    // For BillOrderWitness:
    bytes32 constant PERMIT_WITNESS_TYPEHASH = keccak256(
        "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,"
        "BillOrderWitness(bytes32 orderId,address billerId,bytes32 accountHash,bytes32 ref) TokenPermissions(address token,uint256 amount)"
    );

    bytes32 constant BILL_ORDER_WITNESS_TYPEHASH =
        keccak256("BillOrderWitness(bytes32 orderId,address billerId,bytes32 accountHash,bytes32 ref)");

    // ── setUp ────────────────────────────────────────────────────────────────

    function setUp() public {
        signer = vm.addr(SIGNER_PK);
        // Permit2 checks block.timestamp <= deadline. Forge fork tests pin
        // block.timestamp to the forked block, which may be minutes behind
        // the real clock. Warp to a safe present so deadline = now + 1h works.
        vm.warp(block.timestamp + 2 hours);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    function _domainSep() internal view returns (bytes32) {
        return IPermit2(PERMIT2).DOMAIN_SEPARATOR();
    }

    /// Build the EIP-712 digest for a plain PermitTransferFrom.
    /// spender = the contract that will call Permit2 (msg.sender inside Permit2).
    function _buildDigest(
        address spender,
        uint256 amount,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        bytes32 tpHash    = keccak256(abi.encode(TOKEN_PERMISSIONS_TYPEHASH, USDC, amount));
        bytes32 msgHash   = keccak256(abi.encode(PERMIT_TRANSFER_FROM_TYPEHASH, tpHash, spender, nonce, deadline));
        return keccak256(abi.encodePacked("\x19\x01", _domainSep(), msgHash));
    }

    /// Build the EIP-712 digest for a witness PermitTransferFrom (BillOrderWitness).
    function _buildWitnessDigest(
        address spender,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes32 witness
    ) internal view returns (bytes32) {
        bytes32 tpHash  = keccak256(abi.encode(TOKEN_PERMISSIONS_TYPEHASH, USDC, amount));
        bytes32 msgHash = keccak256(abi.encode(PERMIT_WITNESS_TYPEHASH, tpHash, spender, nonce, deadline, witness));
        return keccak256(abi.encodePacked("\x19\x01", _domainSep(), msgHash));
    }

    /// Sign with pk and return compact (r,s,v) sig.
    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    /// Mock Permit2's transferFrom call to succeed without touching the precompile.
    /// This stubs ONLY the ERC-20 movement so real sig-recovery code still runs.
    function _mockTransfer(address from, address to, uint256 amount) internal {
        vm.mockCall(
            USDC,
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount),
            abi.encode(true)
        );
    }

    // ── FORK TEST 1: domain separator is live-chain-bound ────────────────────
    // Permit2 includes a `name` field: EIP712Domain(string name,uint256 chainId,address verifyingContract)
    // where name = "Permit2".

    function test_Fork_DomainSeparator_MatchesExpected() public view {
        bytes32 domSep = _domainSep();
        // Permit2 domain = EIP712Domain(string name, uint256 chainId, address verifyingContract)
        // chainId on Arc Testnet is 5042002
        bytes32 expected = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
            keccak256("Permit2"),
            uint256(5042002),
            PERMIT2
        ));
        assertEq(domSep, expected, "Permit2 domain separator must match Arc Testnet chainId 5042002 with name");
    }

    // ── FORK TEST 2: valid plain-transfer sig is accepted ────────────────────

    function test_Fork_PlainPermit_ValidSig_Accepted() public {
        uint256 amount   = 5 * 1e6;
        uint256 nonce    = 0;
        uint256 deadline = block.timestamp + 1 hours;
        address spender  = makeAddr("spender"); // arbitrary — we prank as it

        bytes32 digest = _buildDigest(spender, amount, nonce, deadline);
        bytes memory sig = _sign(SIGNER_PK, digest);

        _mockTransfer(signer, spender, amount);

        PermitTransferFrom memory permit = PermitTransferFrom({
            permitted: TokenPermissions({token: USDC, amount: amount}),
            nonce:     nonce,
            deadline:  deadline
        });
        SignatureTransferDetails memory details = SignatureTransferDetails({
            to:              spender,
            requestedAmount: amount
        });

        // Real Permit2 signature verification runs here
        vm.prank(spender);
        IPermit2(PERMIT2).permitTransferFrom(permit, details, signer, sig);
        // Reaching here means sig was valid — Permit2 accepted the real digest
    }

    // ── FORK TEST 3: replay of used nonce reverts ─────────────────────────────

    function test_Fork_PlainPermit_Replay_Reverts() public {
        uint256 amount   = 3 * 1e6;
        uint256 nonce    = 1;
        uint256 deadline = block.timestamp + 1 hours;
        address spender  = makeAddr("spender2");

        bytes32 digest = _buildDigest(spender, amount, nonce, deadline);
        bytes memory sig = _sign(SIGNER_PK, digest);

        _mockTransfer(signer, spender, amount);

        PermitTransferFrom memory permit = PermitTransferFrom({
            permitted: TokenPermissions({token: USDC, amount: amount}),
            nonce:     nonce,
            deadline:  deadline
        });
        SignatureTransferDetails memory details = SignatureTransferDetails({
            to:              spender,
            requestedAmount: amount
        });

        vm.prank(spender);
        IPermit2(PERMIT2).permitTransferFrom(permit, details, signer, sig);

        // Second call with same nonce must revert (nonce bitmap flipped)
        vm.prank(spender);
        vm.expectRevert();
        IPermit2(PERMIT2).permitTransferFrom(permit, details, signer, sig);
    }

    // ── FORK TEST 4: zeroed sig reverts ──────────────────────────────────────

    function test_Fork_PlainPermit_ZeroSig_Reverts() public {
        uint256 amount   = 2 * 1e6;
        uint256 nonce    = 2;
        uint256 deadline = block.timestamp + 1 hours;
        address spender  = makeAddr("spender3");

        PermitTransferFrom memory permit = PermitTransferFrom({
            permitted: TokenPermissions({token: USDC, amount: amount}),
            nonce:     nonce,
            deadline:  deadline
        });
        SignatureTransferDetails memory details = SignatureTransferDetails({
            to:              spender,
            requestedAmount: amount
        });

        bytes memory badSig = new bytes(65);

        vm.prank(spender);
        vm.expectRevert();
        IPermit2(PERMIT2).permitTransferFrom(permit, details, signer, badSig);
    }

    // ── FORK TEST 5: wrong-chainId sig reverts ────────────────────────────────

    function test_Fork_PlainPermit_WrongChainId_Reverts() public {
        uint256 amount   = 4 * 1e6;
        uint256 nonce    = 3;
        uint256 deadline = block.timestamp + 1 hours;
        address spender  = makeAddr("spender4");

        // Build digest with wrong chainId (1 = Ethereum mainnet)
        bytes32 wrongDomSep = keccak256(abi.encode(
            keccak256("EIP712Domain(uint256 chainId,address verifyingContract)"),
            uint256(1),
            PERMIT2
        ));
        bytes32 tpHash  = keccak256(abi.encode(TOKEN_PERMISSIONS_TYPEHASH, USDC, amount));
        bytes32 msgHash = keccak256(abi.encode(PERMIT_TRANSFER_FROM_TYPEHASH, tpHash, spender, nonce, deadline));
        bytes32 wrongDigest = keccak256(abi.encodePacked("\x19\x01", wrongDomSep, msgHash));
        bytes memory sig = _sign(SIGNER_PK, wrongDigest);

        PermitTransferFrom memory permit = PermitTransferFrom({
            permitted: TokenPermissions({token: USDC, amount: amount}),
            nonce:     nonce,
            deadline:  deadline
        });
        SignatureTransferDetails memory details = SignatureTransferDetails({
            to:              spender,
            requestedAmount: amount
        });

        _mockTransfer(signer, spender, amount);

        vm.prank(spender);
        vm.expectRevert();
        IPermit2(PERMIT2).permitTransferFrom(permit, details, signer, sig);
    }

    // ── FORK TEST 6: witness binding — valid witness accepted ─────────────────

    function test_Fork_WitnessPermit_Valid_Accepted() public {
        uint256 amount    = 5 * 1e6;
        uint256 nonce     = 4;
        uint256 deadline  = block.timestamp + 1 hours;
        // Use fixed addresses to avoid any makeAddr/vm.addr side-effects in view helpers
        address spender     = address(0xAAAA);
        address billerAddr  = address(0xBBBB);
        bytes32 accountHash = keccak256("account:12345");
        bytes32 ref         = keccak256("ref:INV-001");
        bytes32 orderId     = keccak256("orderId:001");

        bytes32 witness = keccak256(abi.encode(
            BILL_ORDER_WITNESS_TYPEHASH,
            orderId,
            billerAddr,
            accountHash,
            ref
        ));

        bytes32 digest  = _buildWitnessDigest(spender, amount, nonce, deadline, witness);
        bytes memory sig = _sign(SIGNER_PK, digest);

        _mockTransfer(signer, spender, amount);

        // Call permitWitnessTransferFrom on real Permit2 via low-level call.
        // abi.encodeWithSignature handles the struct tuple encoding correctly.
        // Correct selector: inner struct TokenPermissions is a nested tuple ((address,uint256),...)
        // NOT flattened. Cast: cast sig "permitWitnessTransferFrom(((address,uint256),uint256,uint256),(address,uint256),address,bytes32,string,bytes)" == 0x137c29fe
        bytes4 sel = bytes4(0x137c29fe);
        bytes memory callData = abi.encodeWithSelector(
            sel,
            PermitTransferFrom({
                permitted: TokenPermissions({token: USDC, amount: amount}),
                nonce: nonce,
                deadline: deadline
            }),
            SignatureTransferDetails({to: spender, requestedAmount: amount}),
            signer,
            witness,
            "BillOrderWitness(bytes32 orderId,address billerId,bytes32 accountHash,bytes32 ref) TokenPermissions(address token,uint256 amount)",
            sig
        );

        vm.prank(spender);
        (bool ok, bytes memory ret) = PERMIT2.call(callData);
        // Bubble up revert reason for debugging
        if (!ok && ret.length > 0) { assembly { revert(add(ret, 32), mload(ret)) } }
        assertTrue(ok, "witness permitTransferFrom should succeed with valid sig");
    }

    // ── FORK TEST 7: tampered witness reverts ────────────────────────────────

    function test_Fork_WitnessPermit_TamperedWitness_Reverts() public {
        uint256 amount    = 4 * 1e6;
        uint256 nonce     = 5;
        uint256 deadline  = block.timestamp + 1 hours;
        address spender   = makeAddr("router2");
        bytes32 accountHash = keccak256("account:tamper");
        bytes32 ref         = keccak256("ref:ORIGINAL");
        bytes32 orderId     = keccak256("orderId:tamper");

        // Sign with correct witness
        bytes32 correctWitness = keccak256(abi.encode(
            BILL_ORDER_WITNESS_TYPEHASH, orderId,
            makeAddr("biller"), accountHash, ref
        ));
        bytes32 digest  = _buildWitnessDigest(spender, amount, nonce, deadline, correctWitness);
        bytes memory sig = _sign(SIGNER_PK, digest);

        // Submit with tampered witness (different ref)
        bytes32 tamperedWitness = keccak256(abi.encode(
            BILL_ORDER_WITNESS_TYPEHASH, orderId,
            makeAddr("biller"), accountHash, keccak256("ref:TAMPERED")
        ));

        _mockTransfer(signer, spender, amount);

        bytes4 sel2 = bytes4(0x137c29fe); // permitWitnessTransferFrom(((address,uint256),uint256,uint256),...)

        bytes memory callData = abi.encodeWithSelector(
            sel2,
            PermitTransferFrom({
                permitted: TokenPermissions({token: USDC, amount: amount}),
                nonce: nonce,
                deadline: deadline
            }),
            SignatureTransferDetails({to: spender, requestedAmount: amount}),
            signer,
            tamperedWitness,          // ← tampered
            "BillOrderWitness(bytes32 orderId,address billerId,bytes32 accountHash,bytes32 ref) TokenPermissions(address token,uint256 amount)",
            sig                       // ← signed over correctWitness
        );

        vm.prank(spender);
        (bool ok, ) = PERMIT2.call(callData);
        assertFalse(ok, "tampered witness must cause Permit2 to reject");
    }

    // ── FORK TEST 8: nonce bitmap state after use ────────────────────────────

    function test_Fork_NonceBitmap_UpdatedAfterUse() public {
        uint256 amount   = 1 * 1e6;
        uint256 nonce    = 6;
        uint256 deadline = block.timestamp + 1 hours;
        address spender  = makeAddr("spender5");

        // word = nonce / 256, bit = nonce % 256
        uint256 wordPos = nonce / 256;
        uint256 bitPos  = nonce % 256;

        // Bitmap before: bit 6 is 0
        uint256 bitmapBefore = IPermit2(PERMIT2).nonceBitmap(signer, wordPos);
        assertEq((bitmapBefore >> bitPos) & 1, 0, "nonce not yet used");

        bytes32 digest = _buildDigest(spender, amount, nonce, deadline);
        bytes memory sig = _sign(SIGNER_PK, digest);

        _mockTransfer(signer, spender, amount);

        PermitTransferFrom memory permit = PermitTransferFrom({
            permitted: TokenPermissions({token: USDC, amount: amount}),
            nonce:     nonce,
            deadline:  deadline
        });
        SignatureTransferDetails memory details = SignatureTransferDetails({
            to:              spender,
            requestedAmount: amount
        });

        vm.prank(spender);
        IPermit2(PERMIT2).permitTransferFrom(permit, details, signer, sig);

        // Bitmap after: bit 6 must be 1
        uint256 bitmapAfter = IPermit2(PERMIT2).nonceBitmap(signer, wordPos);
        assertEq((bitmapAfter >> bitPos) & 1, 1, "nonce must be marked used");
    }

    // ── FORK TEST 9: no-drain — admin has no sweep/withdraw function ─────────

    function test_Fork_NoDirectDrainByAdmin() public {
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = bytes4(keccak256("withdrawAll()"));
        selectors[1] = bytes4(keccak256("sweep(address)"));
        selectors[2] = bytes4(keccak256("rescue(address,uint256)"));
        selectors[3] = bytes4(keccak256("emergencyWithdraw()"));

        // A freshly deployed PayRouter has no drain functions
        HandleRegistry hr = new HandleRegistry(address(this), new bytes32[](0));
        KycRegistry   kr  = new KycRegistry(address(this));
        InitialBiller[] memory billers = new InitialBiller[](0);
        PayRouter pr = new PayRouter(
            USDC, address(kr), address(hr), PERMIT2,
            address(this), address(this),
            PayRouter.TierConfig({perPaymentCap: 5_000_000, dailyCap: 50_000_000}),
            PayRouter.TierConfig({perPaymentCap: 100_000_000, dailyCap: 20_000_000_000}),
            PayRouter.TierConfig({perPaymentCap: 20_000_000_000, dailyCap: 0}),
            25_000_000, 0, 1800, 0, billers
        );

        for (uint256 i = 0; i < selectors.length; i++) {
            (bool ok,) = address(pr).call(abi.encodeWithSelector(selectors[i]));
            assertFalse(ok, "unexpected drain function exists");
        }
    }
}
