// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IndexerRegistry
 * @dev A decentralized indexer registry and query protocol for the Celo blockchain.
 * Allows indexers to register, stake CELO, accept indexing queries, submit results, and build reputation.
 *
 * Author: rindicomfort
 */
contract IndexerRegistry {
    // Custom errors for gas efficiency
    error NotAuthorized();
    error AlreadyRegistered();
    error NotRegistered();
    error InsufficientStake();
    error InsufficientReward();
    error QueryNotFound();
    error QueryNotPending();
    error QueryNotResponded();
    error InvalidResponder();
    error NotRequester();
    error TransferFailed();

    struct Indexer {
        string endpoint;
        uint256 stake;
        bool active;
        uint256 rating;
        uint256 registeredAt;
    }

    struct Score {
        uint256 positiveVotes;
        uint256 negativeVotes;
    }

    struct Query {
        address requester;
        bytes32 queryHash;
        uint256 reward;
        address responder;
        bytes32 responseHash;
        string status; // "pending", "responded", "completed", "disputed"
    }

    // State Variables
    address public immutable owner;
    uint256 public minimumStake = 100 ether; // 100 CELO
    uint256 public slashPenalty = 50 ether;  // 50 CELO
    
    uint256 public nextQueryId = 1;
    uint256 public totalIndexers;

    mapping(address => Indexer) public indexers;
    mapping(address => Score) public indexerScores;
    mapping(uint256 => Query) public queries;

    // Events
    event IndexerRegistered(address indexed indexer, string endpoint, uint256 stake);
    event EndpointUpdated(address indexed indexer, string newEndpoint);
    event IndexerDeregistered(address indexed indexer, uint256 refund);
    event QueryRequested(uint256 indexed queryId, address indexed requester, bytes32 queryHash, uint256 reward);
    event ResponseSubmitted(uint256 indexed queryId, address indexed responder, bytes32 responseHash);
    event QueryFinalized(uint256 indexed queryId, bool approved, uint256 rewardTransfer);
    event IndexerSlashed(address indexed indexer, uint256 amountSlashed);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Register as an indexer by staking CELO.
     * @param endpoint The URL/API endpoint of the indexer node.
     */
    function registerIndexer(string calldata endpoint) external payable {
        if (indexers[msg.sender].active) revert AlreadyRegistered();
        if (msg.value < minimumStake) revert InsufficientStake();

        indexers[msg.sender] = Indexer({
            endpoint: endpoint,
            stake: msg.value,
            active: true,
            rating: 100, // Initial rating
            registeredAt: block.number
        });

        // Initialize score if it hasn't been set
        if (indexerScores[msg.sender].positiveVotes == 0 && indexerScores[msg.sender].negativeVotes == 0) {
            indexerScores[msg.sender] = Score(0, 0);
        }

        totalIndexers++;

        emit IndexerRegistered(msg.sender, endpoint, msg.value);
    }

    /**
     * @notice Update the API endpoint URL.
     */
    function updateEndpoint(string calldata newEndpoint) external {
        Indexer storage indexer = indexers[msg.sender];
        if (!indexer.active) revert NotRegistered();

        indexer.endpoint = newEndpoint;

        emit EndpointUpdated(msg.sender, newEndpoint);
    }

    /**
     * @notice Deregister and claim back the stake.
     */
    function deregisterIndexer() external {
        Indexer storage indexer = indexers[msg.sender];
        if (!indexer.active) revert NotRegistered();

        uint256 refundAmount = indexer.stake;
        
        indexer.active = false;
        indexer.stake = 0;
        totalIndexers--;

        emit IndexerDeregistered(msg.sender, refundAmount);

        (bool success, ) = msg.sender.call{value: refundAmount}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Request an indexing query by locking a CELO reward.
     * @param queryHash Hash representing the query query parameters.
     */
    function requestQuery(bytes32 queryHash) external payable returns (uint256) {
        if (msg.value == 0) revert InsufficientReward();

        uint256 queryId = nextQueryId++;

        queries[queryId] = Query({
            requester: msg.sender,
            queryHash: queryHash,
            reward: msg.value,
            responder: address(0),
            responseHash: bytes32(0),
            status: "pending"
        });

        emit QueryRequested(queryId, msg.sender, queryHash, msg.value);
        return queryId;
    }

    /**
     * @notice Submit a query response hash as a registered active indexer.
     */
    function submitResponse(uint256 queryId, bytes32 responseHash) external {
        Indexer memory indexer = indexers[msg.sender];
        if (!indexer.active) revert NotRegistered();

        Query storage query = queries[queryId];
        if (query.requester == address(0)) revert QueryNotFound();
        if (keccak256(bytes(query.status)) != keccak256(bytes("pending"))) revert QueryNotPending();

        query.responder = msg.sender;
        query.responseHash = responseHash;
        query.status = "responded";

        emit ResponseSubmitted(queryId, msg.sender, responseHash);
    }

    /**
     * @notice Finalize a query, release/refund the reward, and rate the indexer.
     */
    function finalizeQuery(uint256 queryId, bool approved) external {
        Query storage query = queries[queryId];
        if (query.requester == address(0)) revert QueryNotFound();
        if (msg.sender != query.requester) revert NotRequester();
        if (keccak256(bytes(query.status)) != keccak256(bytes("responded"))) revert QueryNotResponded();

        address responder = query.responder;
        uint256 rewardAmount = query.reward;

        if (approved) {
            query.status = "completed";
            indexerScores[responder].positiveVotes++;

            emit QueryFinalized(queryId, true, rewardAmount);

            (bool success, ) = responder.call{value: rewardAmount}("");
            if (!success) revert TransferFailed();
        } else {
            query.status = "disputed";
            indexerScores[responder].negativeVotes++;

            emit QueryFinalized(queryId, false, rewardAmount);

            // Refund the requester
            (bool success, ) = query.requester.call{value: rewardAmount}("");
            if (!success) revert TransferFailed();
        }
    }

    /**
     * @notice Slash a malicious or offline indexer.
     */
    function slashIndexer(address indexerAddress) external onlyOwner {
        Indexer storage indexer = indexers[indexerAddress];
        if (!indexer.active) revert NotRegistered();

        uint256 staked = indexer.stake;
        uint256 burnAmount = staked >= slashPenalty ? slashPenalty : staked;

        indexer.active = false;
        indexer.stake = staked - burnAmount;
        totalIndexers--;

        emit IndexerSlashed(indexerAddress, burnAmount);

        // Send the slashed funds to the owner
        (bool success, ) = owner.call{value: burnAmount}("");
        if (!success) revert TransferFailed();
    }

    // Read-only Helper Functions

    function getIndexerScore(address indexerAddress) external view returns (uint256 positive, uint256 negative) {
        Score memory score = indexerScores[indexerAddress];
        return (score.positiveVotes, score.negativeVotes);
    }
}
