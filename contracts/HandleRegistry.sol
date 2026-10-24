// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract HandleRegistry is AccessControl {
    error InvalidHandleFormat();
    error HandleTaken();
    error HandleReserved();
    error WalletAlreadyHasHandle();
    error NoHandleHeld();

    event HandleClaimed(address indexed owner, string handle);
    event HandleReleased(address indexed owner, string handle);

    mapping(address wallet => bytes32 handleHash) private _handleOf;
    mapping(bytes32 handleHash => address owner) private _ownerOf;
    mapping(bytes32 handleHash => string handle) private _handleString;
    mapping(bytes32 handleHash => bool reserved) private _reserved;

    constructor(address initialAdmin, bytes32[] memory reservedHandleHashes) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);

        uint256 length = reservedHandleHashes.length;
        for (uint256 i = 0; i < length; ++i) {
            _reserved[reservedHandleHashes[i]] = true;
        }
    }

    /**
     * @notice Claims a new handle for the caller.
     * @dev Reverts if the format is invalid, the handle is reserved or already taken,
     * or the caller already has a handle.
     * @param handle The handle string to claim.
     */
    function claimHandle(string calldata handle) external {
        _validateHandle(handle);

        bytes32 handleHash = keccak256(bytes(handle));

        if (_reserved[handleHash]) revert HandleReserved();
        if (_ownerOf[handleHash] != address(0)) revert HandleTaken();
        if (_handleOf[msg.sender] != bytes32(0)) revert WalletAlreadyHasHandle();

        _handleOf[msg.sender] = handleHash;
        _ownerOf[handleHash] = msg.sender;
        _handleString[handleHash] = handle;

        emit HandleClaimed(msg.sender, handle);
    }

    /**
     * @notice Releases the caller's current handle.
     * @dev Reverts if the caller does not currently hold a handle.
     */
    function releaseHandle() external {
        bytes32 handleHash = _handleOf[msg.sender];
        if (handleHash == bytes32(0)) revert NoHandleHeld();

        string memory handle = _handleString[handleHash];

        delete _handleOf[msg.sender];
        delete _ownerOf[handleHash];
        delete _handleString[handleHash];

        emit HandleReleased(msg.sender, handle);
    }

    /**
     * @notice Resolves a handle to its owner wallet.
     * @param handle The handle string to resolve.
     * @return The owner address, or address(0) if unclaimed.
     */
    function resolveHandle(string calldata handle) external view returns (address) {
        return _ownerOf[keccak256(bytes(handle))];
    }

    /**
     * @notice Returns the handle currently held by a wallet.
     * @param wallet The wallet to query.
     * @return The handle string, or an empty string if none.
     */
    function handleOf(address wallet) external view returns (string memory) {
        bytes32 handleHash = _handleOf[wallet];
        if (handleHash == bytes32(0)) {
            return "";
        }

        return _handleString[handleHash];
    }

    /**
     * @notice Returns whether a handle hash is reserved.
     * @param handle The handle string to check.
     * @return True if the handle hash is reserved, false otherwise.
     */
    function isReserved(string calldata handle) public view returns (bool) {
        return _reserved[keccak256(bytes(handle))];
    }

    function _validateHandle(string calldata handle) internal pure {
        bytes calldata value = bytes(handle);
        uint256 length = value.length;

        if (length < 3 || length > 20) revert InvalidHandleFormat();

        bytes1 first = value[0];
        if (first < 0x61 || first > 0x7A) revert InvalidHandleFormat();

        for (uint256 i = 1; i < length; ++i) {
            bytes1 char = value[i];

            bool isLowercaseLetter = char >= 0x61 && char <= 0x7A;
            bool isDigit = char >= 0x30 && char <= 0x39;
            bool isUnderscore = char == 0x5F;

            if (!isLowercaseLetter && !isDigit && !isUnderscore) {
                revert InvalidHandleFormat();
            }
        }
    }
}
