// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

/**
 * @title VerificationStorage
 * @dev Smart contract for storing KYC verification hashes on blockchain
 * @notice This contract allows storing verification hashes with user addresses and verification attempts
 */
contract VerificationStorage {
    
    // Struct to store verification data
    struct VerificationRecord {
        string hash;           // SHA-256 hash of verification data
        uint256 verificationIndex;  // Number of verification attempts for this user
        uint256 timestamp;     // Block timestamp when verification was stored
        bool isActive;         // Whether this verification is still active
    }
    
    // Mapping from user address to their verification records
    mapping(address => VerificationRecord[]) public userVerifications;
    
    // Mapping to track total verification count per user
    mapping(address => uint256) public userVerificationCount;
    
    // Event emitted when a new verification hash is stored
    event VerificationStored(
        address indexed user,
        string hash,
        uint256 verificationIndex,
        uint256 timestamp
    );
    
    // Event emitted when a verification is deactivated
    event VerificationDeactivated(
        address indexed user,
        uint256 verificationIndex
    );
    
    // Custom errors
    error InvalidHash();
    error VerificationNotFound();
    error UnauthorizedAccess();
    
    /**
     * @dev Store a new verification hash for a user
     * @param _hash The SHA-256 hash to store
     * @return verificationIndex The index of this verification attempt
     */
    function storeVerificationHash(string memory _hash) external returns (uint256) {
        // Validate hash is not empty
        if (bytes(_hash).length == 0) {
            revert InvalidHash();
        }
        
        address user = msg.sender;
        uint256 currentIndex = userVerificationCount[user] + 1;
        
        // Create new verification record
        VerificationRecord memory newRecord = VerificationRecord({
            hash: _hash,
            verificationIndex: currentIndex,
            timestamp: block.timestamp,
            isActive: true
        });
        
        // Store the record
        userVerifications[user].push(newRecord);
        userVerificationCount[user] = currentIndex;
        
        // Emit event
        emit VerificationStored(user, _hash, currentIndex, block.timestamp);
        
        return currentIndex;
    }
    
    /**
     * @dev Get the latest verification record for a user
     * @param _user The user address to query
     * @return hash The verification hash
     * @return verificationIndex The verification attempt number
     * @return timestamp When the verification was stored
     * @return isActive Whether the verification is active
     */
    function getLatestVerification(address _user) 
        external 
        view 
        returns (string memory hash, uint256 verificationIndex, uint256 timestamp, bool isActive) 
    {
        uint256 count = userVerificationCount[_user];
        if (count == 0) {
            revert VerificationNotFound();
        }
        
        VerificationRecord memory latest = userVerifications[_user][count - 1];
        return (latest.hash, latest.verificationIndex, latest.timestamp, latest.isActive);
    }
    
    /**
     * @dev Get a specific verification record by index
     * @param _user The user address to query
     * @param _index The verification index (1-based)
     * @return hash The verification hash
     * @return verificationIndex The verification attempt number
     * @return timestamp When the verification was stored
     * @return isActive Whether the verification is active
     */
    function getVerificationByIndex(address _user, uint256 _index)
        external
        view
        returns (string memory hash, uint256 verificationIndex, uint256 timestamp, bool isActive)
    {
        if (_index == 0 || _index > userVerificationCount[_user]) {
            revert VerificationNotFound();
        }
        
        VerificationRecord memory record = userVerifications[_user][_index - 1];
        return (record.hash, record.verificationIndex, record.timestamp, record.isActive);
    }
    
    /**
     * @dev Get all verification hashes for a user
     * @param _user The user address to query
     * @return hashes Array of all verification hashes
     * @return indices Array of verification indices
     * @return timestamps Array of timestamps
     * @return activeStates Array of active states
     */
    function getAllUserVerifications(address _user)
        external
        view
        returns (
            string[] memory hashes,
            uint256[] memory indices,
            uint256[] memory timestamps,
            bool[] memory activeStates
        )
    {
        uint256 count = userVerificationCount[_user];
        
        hashes = new string[](count);
        indices = new uint256[](count);
        timestamps = new uint256[](count);
        activeStates = new bool[](count);
        
        for (uint256 i = 0; i < count; i++) {
            VerificationRecord memory record = userVerifications[_user][i];
            hashes[i] = record.hash;
            indices[i] = record.verificationIndex;
            timestamps[i] = record.timestamp;
            activeStates[i] = record.isActive;
        }
        
        return (hashes, indices, timestamps, activeStates);
    }
    
    /**
     * @dev Deactivate a specific verification (only by the owner)
     * @param _index The verification index to deactivate
     */
    function deactivateVerification(uint256 _index) external {
        address user = msg.sender;
        
        if (_index == 0 || _index > userVerificationCount[user]) {
            revert VerificationNotFound();
        }
        
        userVerifications[user][_index - 1].isActive = false;
        
        emit VerificationDeactivated(user, _index);
    }
    
    /**
     * @dev Get the total number of verifications for a user
     * @param _user The user address to query
     * @return count The total verification count
     */
    function getUserVerificationCount(address _user) external view returns (uint256) {
        return userVerificationCount[_user];
    }
    
    /**
     * @dev Check if a specific hash exists for a user
     * @param _user The user address to check
     * @param _hash The hash to search for
     * @return exists Whether the hash exists
     * @return verificationIndex The index of the hash if it exists
     */
    function verificationExists(address _user, string memory _hash) 
        external 
        view 
        returns (bool exists, uint256 verificationIndex) 
    {
        uint256 count = userVerificationCount[_user];
        
        for (uint256 i = 0; i < count; i++) {
            if (keccak256(bytes(userVerifications[_user][i].hash)) == keccak256(bytes(_hash))) {
                return (true, userVerifications[_user][i].verificationIndex);
            }
        }
        
        return (false, 0);
    }
}
