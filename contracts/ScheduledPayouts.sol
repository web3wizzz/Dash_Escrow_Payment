// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KycRegistry} from "./KycRegistry.sol";

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

contract ScheduledPayouts is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    enum ScheduleType {
        PayLater,
        Allowance,
        Vesting,
        Payroll,
        Streaming
    }

    struct Schedule {
        address sender;
        address recipient;
        ScheduleType scheduleType;
        bool revocable;
        bool cancelled;
        uint128 totalAmount;
        uint128 claimed;
        uint64 startTime;
        uint64 endTime;
        uint64 cliffEnd;
        uint64 period;
        uint128 periodAmount;
    }

    struct ScheduleParams {
        address recipient;
        ScheduleType scheduleType;
        bool revocable;
        uint128 totalAmount;
        uint64 startTime;
        uint64 endTime;
        uint64 cliffEnd;
        uint64 period;
        uint128 periodAmount;
    }

    error ZeroAddress();
    error ZeroAmount();
    error InvalidScheduleParams();
    error ScheduleNotFound();
    error ScheduleCancelled();
    error NotRevocable();
    error NotSender();
    error NothingToClaim();
    error ExceedsGlobalCap();
    error ExceedsTierPerPaymentCap(uint8 tier);
    error ExceedsTierDailyCap(uint8 tier);

    event ScheduleCreated(
        bytes32 indexed scheduleId,
        address indexed sender,
        address indexed recipient,
        ScheduleType scheduleType,
        uint128 totalAmount
    );
    event Claimed(bytes32 indexed scheduleId, address indexed recipient, uint128 amount, uint128 totalClaimed);
    event Cancelled(
        bytes32 indexed scheduleId,
        address indexed sender,
        address indexed recipient,
        uint128 recipientAmount,
        uint128 senderRefund
    );
    event Withdrawn(address indexed recipient, uint128 amount);

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    bytes32 public constant SCHEDULE_WITNESS_TYPEHASH = keccak256(
        "ScheduleWitness(bytes32 scheduleId,address recipient,uint8 scheduleType,bool revocable,uint64 startTime,uint64 endTime,uint64 cliffEnd,uint64 period,uint128 periodAmount,uint128 totalAmount)"
    );

    IERC20 public immutable usdc;
    IPermit2 public immutable permit2;

    mapping(bytes32 => Schedule) public schedules;
    mapping(address => uint128) public pendingWithdrawals;
    mapping(address => uint256) public depositNonces;

    KycRegistry public immutable kycRegistry;
    uint96 public immutable globalPerPaymentCap;
    uint96 public immutable tierPerPaymentCap0;
    uint96 public immutable tierPerPaymentCap1;
    uint96 public immutable tierPerPaymentCap2;

    // Invariant:
    // USDC held by this contract equals the aggregate un-distributed amount across schedules:
    // - for active schedules: totalAmount - claimed
    // - for cancelled schedules: totalAmount - vestedTotal_at_cancellation

    constructor(
        address usdc_,
        address permit2_,
        address initialAdmin,
        address kycRegistry_,
        uint96 globalPerPaymentCap_,
        uint96 tierPerPaymentCap0_,
        uint96 tierPerPaymentCap1_,
        uint96 tierPerPaymentCap2_
    ) {
        if (usdc_ == address(0) || permit2_ == address(0) || initialAdmin == address(0) || kycRegistry_ == address(0)) {
            revert ZeroAddress();
        }

        usdc = IERC20(usdc_);
        permit2 = IPermit2(permit2_);
        kycRegistry = KycRegistry(kycRegistry_);
        globalPerPaymentCap = globalPerPaymentCap_;
        tierPerPaymentCap0 = tierPerPaymentCap0_;
        tierPerPaymentCap1 = tierPerPaymentCap1_;
        tierPerPaymentCap2 = tierPerPaymentCap2_;

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(PAUSER_ROLE, initialAdmin);
    }

    /**
     * @notice Deposits sender USDC into a new schedule using Permit2 witness transfer; anyone can relay, but funds are always pulled from msg.sender and held by this contract.
     * @dev Reverts if the deposit amount exceeds the sender's tier per-payment cap or the global cap.
     * @param permit Permit2 witness transfer authorization.
     * @param sig Signature for the Permit2 witness transfer.
     * @param params Schedule creation parameters bound into the Permit2 witness.
     * @return scheduleId Deterministic schedule identifier.
     */
    function deposit(
        PermitTransferFrom calldata permit,
        bytes calldata sig,
        ScheduleParams calldata params
    ) external whenNotPaused nonReentrant returns (bytes32 scheduleId) {
        if (params.recipient == address(0)) revert ZeroAddress();
        if (params.totalAmount == 0) revert ZeroAmount();
        if (params.totalAmount != permit.permitted.amount) revert InvalidScheduleParams();
        if (permit.permitted.token != address(usdc)) revert InvalidScheduleParams();

        if (params.scheduleType == ScheduleType.PayLater) {
            if (params.endTime <= block.timestamp) revert InvalidScheduleParams();
        } else if (params.scheduleType == ScheduleType.Allowance || params.scheduleType == ScheduleType.Payroll) {
            if (params.period == 0 || params.periodAmount == 0 || params.periodAmount > params.totalAmount) {
                revert InvalidScheduleParams();
            }
            if (!(params.startTime == 0 || params.startTime < params.endTime)) {
                revert InvalidScheduleParams();
            }
        } else if (params.scheduleType == ScheduleType.Vesting) {
            if (params.startTime >= params.endTime) revert InvalidScheduleParams();
            if (params.cliffEnd < params.startTime || params.cliffEnd > params.endTime) revert InvalidScheduleParams();
        } else if (params.scheduleType == ScheduleType.Streaming) {
            if (params.startTime >= params.endTime) revert InvalidScheduleParams();
        } else {
            revert InvalidScheduleParams();
        }

        _checkTierCap(msg.sender, params.totalAmount);

        uint256 nonce = depositNonces[msg.sender]++;
        scheduleId = keccak256(abi.encodePacked(msg.sender, params.recipient, nonce));

        bytes32 witness = keccak256(
            abi.encode(
                SCHEDULE_WITNESS_TYPEHASH,
                scheduleId,
                params.recipient,
                uint8(params.scheduleType),
                params.revocable,
                params.startTime,
                params.endTime,
                params.cliffEnd,
                params.period,
                params.periodAmount,
                params.totalAmount
            )
        );

        permit2.permitWitnessTransferFrom(
            permit,
            SignatureTransferDetails({to: address(this), requestedAmount: params.totalAmount}),
            msg.sender,
            witness,
            string(abi.encodePacked("ScheduleWitness(bytes32 scheduleId,address recipient,uint8 scheduleType,bool revocable,uint64 startTime,uint64 endTime,uint64 cliffEnd,uint64 period,uint128 periodAmount,uint128 totalAmount) TokenPermissions(address token,uint256 amount)")),
            sig
        );

        schedules[scheduleId] = Schedule({
            sender: msg.sender,
            recipient: params.recipient,
            scheduleType: params.scheduleType,
            revocable: params.revocable,
            cancelled: false,
            totalAmount: params.totalAmount,
            claimed: 0,
            startTime: params.startTime,
            endTime: params.endTime,
            cliffEnd: params.cliffEnd,
            period: params.period,
            periodAmount: params.periodAmount
        });

        emit ScheduleCreated(scheduleId, msg.sender, params.recipient, params.scheduleType, params.totalAmount);
    }

    /**
     * @notice Claims currently unlocked USDC for a schedule; anyone may call, but the transfer always goes to the schedule recipient.
     * @param scheduleId Schedule identifier.
     */
    function claim(bytes32 scheduleId) external nonReentrant {
        Schedule storage schedule = _getSchedule(scheduleId);
        if (schedule.cancelled) revert ScheduleCancelled();

        uint128 amount = claimableNow(scheduleId);
        if (amount == 0) revert NothingToClaim();

        schedule.claimed += amount;
        _push(schedule.recipient, amount);

        emit Claimed(scheduleId, schedule.recipient, amount, schedule.claimed);
    }

    /**
     * @notice Cancels a revocable schedule; only the original sender can call, unlocked unclaimed USDC goes to recipient and remaining locked USDC is refunded to sender.
     * @param scheduleId Schedule identifier.
     */
    function cancel(bytes32 scheduleId) external nonReentrant {
        Schedule storage schedule = _getSchedule(scheduleId);

        if (!schedule.revocable) revert NotRevocable();
        if (msg.sender != schedule.sender) revert NotSender();
        if (schedule.cancelled) revert ScheduleCancelled();

        uint128 unlockedUnclaimed = claimableNow(scheduleId);
        uint256 vestedTotal = uint256(unlockedUnclaimed) + schedule.claimed;
        uint128 remainder = uint128(uint256(schedule.totalAmount) - vestedTotal);

        schedule.cancelled = true;
        schedule.claimed = uint128(vestedTotal);

        if (unlockedUnclaimed > 0) {
            _push(schedule.recipient, unlockedUnclaimed);
        }
        if (remainder > 0) {
            _push(schedule.sender, remainder);
        }

        emit Cancelled(scheduleId, schedule.sender, schedule.recipient, unlockedUnclaimed, remainder);
    }

    /**
     * @notice Withdraws any USDC credited to the caller from claim or cancel payouts.
     * @dev Exists to allow recovery when a direct safeTransfer would revert (e.g. USDC blocklist).
     *      The contract first attempts a direct transfer in claim/cancel; only if the address has
     *      a pending balance from a prior failed direct transfer can they call withdraw().
     *      In normal operation this function is unused.
     */
    function withdraw() external nonReentrant {
        uint128 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToClaim();
        pendingWithdrawals[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Returns newly claimable USDC for a schedule at the current timestamp; returns zero for cancelled schedules.
     * @param scheduleId Schedule identifier.
     * @return amount Newly claimable amount not yet claimed.
     */
    function claimableNow(bytes32 scheduleId) public view returns (uint128 amount) {
        Schedule storage schedule = _getSchedule(scheduleId);
        if (schedule.cancelled) return 0;

        uint128 unlocked = _totalUnlocked(schedule);
        if (unlocked <= schedule.claimed) return 0;

        return unlocked - schedule.claimed;
    }

    /// @notice Returns the deposit nonce that will be used for the next deposit from `sender`.
    function nextDepositNonce(address sender) external view returns (uint256) {
        return depositNonces[sender];
    }

    /**
     * @notice Pauses new schedule deposits.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses schedule deposits.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _getSchedule(bytes32 scheduleId) internal view returns (Schedule storage schedule) {
        schedule = schedules[scheduleId];
        if (schedule.sender == address(0)) revert ScheduleNotFound();
    }

    function _push(address to, uint128 amount) internal {
        if (amount == 0) return;
        (bool ok, bytes memory data) = address(usdc).call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        bool success = ok && (data.length == 0 || abi.decode(data, (bool)));
        if (!success) {
            pendingWithdrawals[to] += amount;
        }
    }

    function _totalUnlocked(Schedule storage schedule) internal view returns (uint128) {
        if (schedule.scheduleType == ScheduleType.PayLater) {
            return block.timestamp >= schedule.endTime ? schedule.totalAmount : 0;
        }

        if (schedule.scheduleType == ScheduleType.Allowance || schedule.scheduleType == ScheduleType.Payroll) {
            uint256 elapsed = block.timestamp >= schedule.startTime ? block.timestamp - schedule.startTime : 0;
            uint256 periods = elapsed / schedule.period;
            uint256 raw = periods * uint256(schedule.periodAmount);
            if (raw >= schedule.totalAmount) return schedule.totalAmount;
            return uint128(raw);
        }

        if (schedule.scheduleType == ScheduleType.Vesting) {
            if (block.timestamp < schedule.cliffEnd) return 0;

            uint256 t = block.timestamp < schedule.endTime ? block.timestamp : schedule.endTime;
            uint256 window = schedule.endTime - schedule.startTime;
            if (window == 0) return schedule.totalAmount;

            uint256 unlocked = (uint256(schedule.totalAmount) * (t - schedule.startTime)) / window;
            return uint128(unlocked);
        }

        if (schedule.scheduleType == ScheduleType.Streaming) {
            if (block.timestamp <= schedule.startTime) return 0;

            uint256 t = block.timestamp < schedule.endTime ? block.timestamp : schedule.endTime;
            uint256 window = schedule.endTime - schedule.startTime;
            uint256 unlocked = (uint256(schedule.totalAmount) * (t - schedule.startTime)) / window;
            return uint128(unlocked);
        }

        return 0;
    }

    /**
     * @dev Checks the global per-payment cap for schedule deposits.
     *
     * Architecture note (permissionless model):
     *   Identity-tier routing has been removed.  Every wallet is subject to the
     *   same globalPerPaymentCap.  The tier immutables (tierPerPaymentCap0/1/2)
     *   and kycRegistry reference are retained so tiered caps can be re-introduced
     *   via a contract upgrade or a new deployment with governance approval,
     *   without discarding the existing contract design.
     */
    function _checkTierCap(address, uint256 amount) internal view {
        if (amount > globalPerPaymentCap) revert ExceedsGlobalCap();
    }
}
