// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KycRegistry} from "./KycRegistry.sol";
import {HandleRegistry} from "./HandleRegistry.sol";

struct TokenPermissions {
    address token;
    uint256 amount;
}

struct PermitTransferFrom {
    TokenPermissions permitted;
    uint256 nonce;
    uint256 deadline;
}

struct SignatureTransferDetails {
    address to;
    uint256 requestedAmount;
}

interface IPermit2 {
    function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;

    function permitWitnessTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external;
}

struct InitialBiller {
    address biller;
    address treasury;
}

contract PayRouter is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    struct TierConfig {
        uint96 perPaymentCap;
        uint96 dailyCap;
    }

    enum OrderStatus {
        Pending,
        Fulfilled,
        Rejected,
        Reclaimed
    }

    struct BillOrder {
        address payer;
        address billerTreasury;
        uint128 amount;
        uint128 feeBps;
        uint64 createdAt;
        OrderStatus status;
    }

    struct PendingChange {
        bytes32 changeId;
        uint256 eta;
        bool executed;
    }

    error HandleNotFound(string handle);
    error InsufficientTierForBillOrder();
    error OrderNotPending();
    error OrderNotExpired();
    error InvalidBiller();
    error InvalidAmount();
    error ZeroAddress();
    error InvalidFeeBps(uint16 bps);
    error InvalidConfig();
    error TimelockNotReady();
    error TimelockAlreadyExecuted();
    error TimelockNotQueued();
    error TimelockPendingExecution();
    error ExceedsGlobalCap();
    error ExceedsTierPerPaymentCap(uint8 tier);
    error ExceedsTierDailyCap(uint8 tier);

    event Sent(address indexed from, address indexed to, uint256 amount);
    event SentToHandle(address indexed from, address indexed to, string handle, uint256 amount);
    event RequestPaid(address indexed payer, address indexed recipient, bytes32 indexed requestId, uint256 amount);
    event OrderCreated(
        bytes32 indexed orderId,
        address indexed payer,
        address indexed billerId,
        bytes32 accountHash,
        bytes32 ref,
        uint256 amount
    );
    event OrderFulfilled(bytes32 indexed orderId, address indexed billerTreasury, uint256 net, uint256 fee);
    event OrderRejected(bytes32 indexed orderId, address indexed payer, uint256 amount);
    event OrderReclaimed(bytes32 indexed orderId, address indexed payer, uint256 amount);
    event ConfigChangeQueued(bytes32 indexed changeKey, uint256 eta);
    event ConfigChangeExecuted(bytes32 indexed changeKey);
    event BillerAdded(address indexed biller, address indexed treasury);
    event BillerRemoved(address indexed biller);

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint16 public constant MAX_FEE_BPS = 200;
    uint256 private constant TIMELOCK_DELAY = 24 hours;

    bytes32 public constant BILL_ORDER_WITNESS_TYPEHASH =
        keccak256("BillOrderWitness(bytes32 orderId,address billerId,bytes32 accountHash,bytes32 ref)");

    bytes32 private constant CHANGE_FEE_BPS = keccak256("feeBps");
    bytes32 private constant CHANGE_GLOBAL_PER_PAYMENT_CAP = keccak256("globalPerPaymentCap");
    bytes32 private constant CHANGE_MIN_BILL_TIER = keccak256("minBillTier");
    bytes32 private constant CHANGE_ORDER_TIMEOUT_SECONDS = keccak256("orderTimeoutSeconds");
    bytes32 private constant CHANGE_ADD_BILLER = keccak256("addBiller");
    bytes32 private constant CHANGE_REMOVE_BILLER = keccak256("removeBiller");
    bytes32 private constant CHANGE_TIER_CONFIG = keccak256("tierConfig");
    bytes32 private constant CHANGE_FEE_WALLET = keccak256("feeWallet");

    IERC20 public immutable usdc;
    KycRegistry public immutable kycRegistry;
    HandleRegistry public immutable handleRegistry;
    IPermit2 public immutable permit2;

    mapping(uint8 => TierConfig) public tierConfigs;
    uint96 public globalPerPaymentCap;
    uint8 public minBillTier;
    uint32 public orderTimeoutSeconds;
    uint16 public feeBps;
    address public feeWallet;

    mapping(address => bool) public isBiller;
    mapping(address => address) public billerTreasury;
    mapping(address => mapping(uint256 => uint128)) private _dailySpend;
    mapping(bytes32 => BillOrder) public orders;
    mapping(address => uint256) private _orderNonces;

    mapping(bytes32 => bytes) private _pendingChanges;
    mapping(bytes32 => uint256) private _pendingEtas;
    mapping(bytes32 => bool) private _pendingExecuted;

    constructor(
        address usdc_,
        address kycRegistry_,
        address handleRegistry_,
        address permit2_,
        address initialAdmin,
        TierConfig memory tier0Config,
        TierConfig memory tier1Config,
        TierConfig memory tier2Config,
        uint96 initialGlobalPerPaymentCap,
        uint8 minBillTier_,
        uint32 orderTimeoutSeconds_,
        uint16 initialFeeBps,
        InitialBiller[] memory initialBillers
    ) {
        if (
            usdc_ == address(0) ||
            kycRegistry_ == address(0) ||
            handleRegistry_ == address(0) ||
            permit2_ == address(0) ||
            initialAdmin == address(0)
        ) {
            revert ZeroAddress();
        }
        if (initialFeeBps > MAX_FEE_BPS) revert InvalidFeeBps(initialFeeBps);
        if (minBillTier_ > 2 || orderTimeoutSeconds_ == 0) revert InvalidConfig();

        usdc = IERC20(usdc_);
        kycRegistry = KycRegistry(kycRegistry_);
        handleRegistry = HandleRegistry(handleRegistry_);
        permit2 = IPermit2(permit2_);

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(PAUSER_ROLE, initialAdmin);

        tierConfigs[0] = tier0Config;
        tierConfigs[1] = tier1Config;
        tierConfigs[2] = tier2Config;

        globalPerPaymentCap = initialGlobalPerPaymentCap;
        minBillTier = minBillTier_;
        orderTimeoutSeconds = orderTimeoutSeconds_;
        feeBps = initialFeeBps;
        feeWallet = initialAdmin;

        for (uint256 i = 0; i < initialBillers.length; i++) {
            address b = initialBillers[i].biller;
            address t = initialBillers[i].treasury;
            if (b == address(0) || t == address(0)) revert ZeroAddress();
            isBiller[b] = true;
            billerTreasury[b] = t;
            emit BillerAdded(b, t);
        }
    }

    /**
     * @notice Sends USDC from caller to a recipient using Permit2 signature transfer.
     * @param permit Permit2 transfer authorization.
     * @param sig Signature for the Permit2 transfer.
     * @param recipient Destination wallet.
     * @param amount Amount of USDC (6 decimals) to send.
     */
    function send(
        PermitTransferFrom calldata permit,
        bytes calldata sig,
        address recipient,
        uint256 amount
    ) external whenNotPaused nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0 || amount != permit.permitted.amount) revert InvalidAmount();
        if (permit.permitted.token != address(usdc)) revert InvalidAmount();

        _checkAndRecordSpend(msg.sender, amount);

        permit2.permitTransferFrom(
            permit,
            SignatureTransferDetails({to: recipient, requestedAmount: amount}),
            msg.sender,
            sig
        );

        emit Sent(msg.sender, recipient, amount);
    }

    /**
     * @notice Sends USDC from caller to the wallet that owns a handle.
     * @param permit Permit2 transfer authorization.
     * @param sig Signature for the Permit2 transfer.
     * @param handle Handle to resolve in the handle registry.
     * @param amount Amount of USDC (6 decimals) to send.
     */
    function sendToHandle(
        PermitTransferFrom calldata permit,
        bytes calldata sig,
        string calldata handle,
        uint256 amount
    ) external whenNotPaused nonReentrant {
        address recipient = handleRegistry.resolveHandle(handle);
        if (recipient == address(0)) revert HandleNotFound(handle);
        if (amount == 0 || amount != permit.permitted.amount) revert InvalidAmount();
        if (permit.permitted.token != address(usdc)) revert InvalidAmount();

        _checkAndRecordSpend(msg.sender, amount);

        permit2.permitTransferFrom(
            permit,
            SignatureTransferDetails({to: recipient, requestedAmount: amount}),
            msg.sender,
            sig
        );

        emit SentToHandle(msg.sender, recipient, handle, amount);
    }

    /**
     * @notice Pays a payment request reference from caller to a recipient.
     * @param permit Permit2 transfer authorization.
     * @param sig Signature for the Permit2 transfer.
     * @param requestId Opaque request identifier for indexing.
     * @param recipient Destination wallet.
     * @param amount Amount of USDC (6 decimals) to send.
     */
    function requestPay(
        PermitTransferFrom calldata permit,
        bytes calldata sig,
        bytes32 requestId,
        address recipient,
        uint256 amount
    ) external whenNotPaused nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0 || amount != permit.permitted.amount) revert InvalidAmount();
        if (permit.permitted.token != address(usdc)) revert InvalidAmount();

        _checkAndRecordSpend(msg.sender, amount);

        permit2.permitTransferFrom(
            permit,
            SignatureTransferDetails({to: recipient, requestedAmount: amount}),
            msg.sender,
            sig
        );

        emit RequestPaid(msg.sender, recipient, requestId, amount);
    }

    /**
     * @notice Creates a bill order and escrows USDC in this contract pending operator action.
     * @param permit Permit2 witness transfer authorization.
     * @param sig Signature for the Permit2 witness transfer.
     * @param billerId Registered biller identifier address.
     * @param accountHash Opaque account reference hash.
     * @param ref Opaque bill reference hash.
     * @param amount Amount of USDC (6 decimals) to escrow.
     * @return orderId Deterministic order identifier.
     */
    function createOrder(
        PermitTransferFrom calldata permit,
        bytes calldata sig,
        address billerId,
        bytes32 accountHash,
        bytes32 ref,
        uint256 amount
    ) external whenNotPaused nonReentrant returns (bytes32 orderId) {
        if (kycRegistry.effectiveTier(msg.sender) < minBillTier) revert InsufficientTierForBillOrder();
        if (!isBiller[billerId]) revert InvalidBiller();
        if (amount == 0 || amount != permit.permitted.amount || amount > type(uint128).max) revert InvalidAmount();
        if (permit.permitted.token != address(usdc)) revert InvalidAmount();

        _checkAndRecordSpend(msg.sender, amount);

        // orderId is deterministic from inputs known before signing: uses per-payer nonce
        // so two payers can submit simultaneously without nonce interference.
        orderId = keccak256(abi.encodePacked(msg.sender, billerId, accountHash, ref, _orderNonces[msg.sender]++));
        bytes32 witness = keccak256(abi.encode(BILL_ORDER_WITNESS_TYPEHASH, orderId, billerId, accountHash, ref));

        permit2.permitWitnessTransferFrom(
            permit,
            SignatureTransferDetails({to: address(this), requestedAmount: amount}),
            msg.sender,
            witness,
            string(abi.encodePacked("BillOrderWitness(bytes32 orderId,address billerId,bytes32 accountHash,bytes32 ref) TokenPermissions(address token,uint256 amount)")),
            sig
        );

        orders[orderId] = BillOrder({
            payer: msg.sender,
            billerTreasury: billerTreasury[billerId],
            amount: uint128(amount),
            feeBps: uint128(feeBps),
            createdAt: uint64(block.timestamp),
            status: OrderStatus.Pending
        });

        emit OrderCreated(orderId, msg.sender, billerId, accountHash, ref, amount);
    }

    /**
     * @notice Releases a pending bill order to the treasury locked at order creation.
     * @param orderId Order identifier.
     */
    function fulfillOrder(bytes32 orderId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        BillOrder storage order = orders[orderId];
        _requirePending(order);

        // Cannot fulfill after the order's own deadline — payer's reclaim window has opened.
        if (block.timestamp >= uint256(order.createdAt) + orderTimeoutSeconds) revert OrderNotPending();

        uint256 fee = (uint256(order.amount) * uint256(order.feeBps)) / 10_000;
        uint256 net = uint256(order.amount) - fee;

        order.status = OrderStatus.Fulfilled;

        usdc.safeTransfer(order.billerTreasury, net);
        if (fee > 0) {
            usdc.safeTransfer(feeWallet, fee);
        }

        emit OrderFulfilled(orderId, order.billerTreasury, net, fee);
    }

    /**
     * @notice Rejects a pending bill order and returns funds to the payer.
     * @param orderId Order identifier.
     */
    function rejectOrder(bytes32 orderId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        BillOrder storage order = orders[orderId];
        _requirePending(order);

        order.status = OrderStatus.Rejected;
        usdc.safeTransfer(order.payer, order.amount);

        emit OrderRejected(orderId, order.payer, order.amount);
    }

    /**
     * @notice Reclaims a pending bill order after timeout and returns funds to the payer.
     * @param orderId Order identifier.
     */
    function reclaimOrder(bytes32 orderId) external nonReentrant {
        BillOrder storage order = orders[orderId];
        _requirePending(order);

        if (block.timestamp < uint256(order.createdAt) + orderTimeoutSeconds) revert OrderNotExpired();

        order.status = OrderStatus.Reclaimed;
        usdc.safeTransfer(order.payer, order.amount);

        emit OrderReclaimed(orderId, order.payer, order.amount);
    }

    /**
     * @notice Queues a timelocked configuration change for execution after 24 hours.
     * @param changeKey Configuration key hash.
     * @param encodedChange ABI-encoded change payload for the key.
     */
    function queueConfigChange(bytes32 changeKey, bytes calldata encodedChange) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_isSupportedChangeKey(changeKey) || encodedChange.length == 0) revert InvalidConfig();

        // Prevent silently overwriting a queued-but-unexecuted change.
        // If a prior change is pending (eta set and not yet executed), it must be executed
        // or explicitly cancelled before a new one can be queued for the same key.
        if (_pendingEtas[changeKey] != 0 && !_pendingExecuted[changeKey]) {
            revert TimelockPendingExecution();
        }

        uint256 eta = block.timestamp + TIMELOCK_DELAY;
        _pendingChanges[changeKey] = encodedChange;
        _pendingEtas[changeKey] = eta;
        _pendingExecuted[changeKey] = false;

        emit ConfigChangeQueued(changeKey, eta);
    }

    /**
     * @notice Executes a queued configuration change once the timelock has elapsed.
     * @param changeKey Configuration key hash.
     */
    function executeConfigChange(bytes32 changeKey) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 eta = _pendingEtas[changeKey];
        if (eta == 0) revert TimelockNotQueued();
        if (_pendingExecuted[changeKey]) revert TimelockAlreadyExecuted();
        if (block.timestamp < eta) revert TimelockNotReady();

        _pendingExecuted[changeKey] = true;
        _applyConfigChange(changeKey, _pendingChanges[changeKey]);

        emit ConfigChangeExecuted(changeKey);
    }

    /**
     * @notice Pauses new payment entrypoints.
     * @dev Does not pause rejectOrder, reclaimOrder, or operator fulfill.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses new payment entrypoints.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Returns the order nonce that will be used for the next createOrder call from `payer`.
     * @dev Per-payer nonce ensures two concurrent payers never interfere with each other.
     * @param payer Wallet address.
     * @return nonce Current (pre-increment) nonce for this payer.
     */
    function orderNonceOf(address payer) external view returns (uint256 nonce) {
        nonce = _orderNonces[payer];
    }

    /**
     * @notice Returns an account's recorded spend in a day bucket.
     * @param payer Wallet address.
     * @param dayBucket Bucket index computed as timestamp / 1 days.
     * @return amount Recorded spend for the bucket.
     */
    function dailySpend(address payer, uint256 dayBucket) external view returns (uint128 amount) {
        return _dailySpend[payer][dayBucket];
    }

    /**
     * @notice Returns queued metadata for a config key.
     * @param changeKey Configuration key hash.
     * @return pending Pending-change metadata.
     * @return encodedChange ABI-encoded queued payload.
     */
    function getPendingChange(
        bytes32 changeKey
    ) external view returns (PendingChange memory pending, bytes memory encodedChange) {
        uint256 eta = _pendingEtas[changeKey];
        encodedChange = _pendingChanges[changeKey];

        pending = PendingChange({
            changeId: keccak256(abi.encode(changeKey, encodedChange, eta)),
            eta: eta,
            executed: _pendingExecuted[changeKey]
        });
    }

    function _checkAndRecordSpend(address payer, uint256 amount) internal {
        uint8 tier = kycRegistry.effectiveTier(payer);
        TierConfig memory cfg = tierConfigs[tier];

        if (amount > globalPerPaymentCap) revert ExceedsGlobalCap();
        if (amount > cfg.perPaymentCap) revert ExceedsTierPerPaymentCap(tier);

        uint256 day = block.timestamp / 1 days;
        uint256 updated = uint256(_dailySpend[payer][day]) + amount;

        if (cfg.dailyCap != 0 && updated > cfg.dailyCap) revert ExceedsTierDailyCap(tier);
        if (updated > type(uint128).max) revert InvalidAmount();

        _dailySpend[payer][day] = uint128(updated);
    }

    function _requirePending(BillOrder storage order) internal view {
        if (order.status != OrderStatus.Pending) revert OrderNotPending();
    }

    function _isSupportedChangeKey(bytes32 changeKey) internal pure returns (bool) {
        return
            changeKey == CHANGE_FEE_BPS ||
            changeKey == CHANGE_GLOBAL_PER_PAYMENT_CAP ||
            changeKey == CHANGE_MIN_BILL_TIER ||
            changeKey == CHANGE_ORDER_TIMEOUT_SECONDS ||
            changeKey == CHANGE_ADD_BILLER ||
            changeKey == CHANGE_REMOVE_BILLER ||
            changeKey == CHANGE_TIER_CONFIG ||
            changeKey == CHANGE_FEE_WALLET;
    }

    function _applyConfigChange(bytes32 changeKey, bytes memory encodedChange) internal {
        if (changeKey == CHANGE_FEE_BPS) {
            uint16 newFeeBps = abi.decode(encodedChange, (uint16));
            if (newFeeBps > MAX_FEE_BPS) revert InvalidFeeBps(newFeeBps);
            feeBps = newFeeBps;
            return;
        }

        if (changeKey == CHANGE_GLOBAL_PER_PAYMENT_CAP) {
            uint96 newGlobalPerPaymentCap = abi.decode(encodedChange, (uint96));
            globalPerPaymentCap = newGlobalPerPaymentCap;
            return;
        }

        if (changeKey == CHANGE_MIN_BILL_TIER) {
            uint8 newMinBillTier = abi.decode(encodedChange, (uint8));
            if (newMinBillTier > 2) revert InvalidConfig();
            minBillTier = newMinBillTier;
            return;
        }

        if (changeKey == CHANGE_ORDER_TIMEOUT_SECONDS) {
            uint32 newOrderTimeoutSeconds = abi.decode(encodedChange, (uint32));
            if (newOrderTimeoutSeconds == 0) revert InvalidConfig();
            orderTimeoutSeconds = newOrderTimeoutSeconds;
            return;
        }

        if (changeKey == CHANGE_ADD_BILLER) {
            (address biller, address treasury) = abi.decode(encodedChange, (address, address));
            if (biller == address(0) || treasury == address(0)) revert ZeroAddress();

            isBiller[biller] = true;
            billerTreasury[biller] = treasury;
            emit BillerAdded(biller, treasury);
            return;
        }

        if (changeKey == CHANGE_REMOVE_BILLER) {
            address biller = abi.decode(encodedChange, (address));
            if (!isBiller[biller]) revert InvalidBiller();

            isBiller[biller] = false;
            delete billerTreasury[biller];
            emit BillerRemoved(biller);
            return;
        }

        if (changeKey == CHANGE_TIER_CONFIG) {
            (uint8 tier, TierConfig memory cfg) = abi.decode(encodedChange, (uint8, TierConfig));
            if (tier > 2) revert InvalidConfig();

            tierConfigs[tier] = cfg;
            return;
        }

        if (changeKey == CHANGE_FEE_WALLET) {
            address newFeeWallet = abi.decode(encodedChange, (address));
            if (newFeeWallet == address(0)) revert ZeroAddress();

            feeWallet = newFeeWallet;
            return;
        }

        revert InvalidConfig();
    }
}
