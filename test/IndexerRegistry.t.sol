// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {IndexerRegistry} from "../contracts/IndexerRegistry.sol";

contract IndexerRegistryTest is Test {
    IndexerRegistry public registry;

    address public owner = address(0xAAAA);
    address public indexer1 = address(0x1111);
    address public indexer2 = address(0x2222);
    address public requester1 = address(0x3333);

    function setUp() public {
        vm.prank(owner);
        registry = new IndexerRegistry();

        // Deal some CELO (native ETH equivalent in sim) to test accounts
        vm.deal(indexer1, 1000 ether);
        vm.deal(indexer2, 1000 ether);
        vm.deal(requester1, 1000 ether);
    }

    function test_RegisterIndexer_Success() public {
        vm.prank(indexer1);
        registry.registerIndexer{value: 100 ether}("https://indexer-celo-1.rindicomfort.io");

        (
            string memory endpoint,
            uint256 stake,
            bool active,
            uint256 rating,
            uint256 registeredAt
        ) = registry.indexers(indexer1);

        assertEq(endpoint, "https://indexer-celo-1.rindicomfort.io");
        assertEq(stake, 100 ether);
        assertTrue(active);
        assertEq(rating, 100);
        assertEq(registeredAt, block.number);
        assertEq(registry.totalIndexers(), 1);
    }

    function test_RegisterIndexer_InsufficientStake_Reverts() public {
        vm.prank(indexer2);
        vm.expectRevert(IndexerRegistry.InsufficientStake.selector);
        registry.registerIndexer{value: 50 ether}("https://indexer-celo-2.rindicomfort.io");
    }

    function test_UpdateEndpoint_Success() public {
        vm.prank(indexer1);
        registry.registerIndexer{value: 100 ether}("https://indexer-celo-1.rindicomfort.io");

        vm.prank(indexer1);
        registry.updateEndpoint("https://new-celo-endpoint.rindicomfort.io");

        (string memory endpoint, , , , ) = registry.indexers(indexer1);
        assertEq(endpoint, "https://new-celo-endpoint.rindicomfort.io");
    }

    function test_QueryLifecycle_Success() public {
        // 1. Register Indexer
        vm.prank(indexer1);
        registry.registerIndexer{value: 100 ether}("https://indexer-celo-1.rindicomfort.io");

        // 2. Request Query
        bytes32 queryHash = keccak256("fetch-celo-transactions");
        vm.prank(requester1);
        uint256 queryId = registry.requestQuery{value: 10 ether}(queryHash);

        assertEq(queryId, 1);

        // Verify Query record
        (
            address requester,
            bytes32 qHash,
            uint256 reward,
            address responder,
            bytes32 rHash,
            string memory status
        ) = registry.queries(queryId);

        assertEq(requester, requester1);
        assertEq(qHash, queryHash);
        assertEq(reward, 10 ether);
        assertEq(responder, address(0));
        assertEq(rHash, bytes32(0));
        assertEq(status, "pending");

        // 3. Submit Response
        bytes32 responseHash = keccak256("result-block-data");
        vm.prank(indexer1);
        registry.submitResponse(queryId, responseHash);

        (, , , responder, rHash, status) = registry.queries(queryId);
        assertEq(responder, indexer1);
        assertEq(rHash, responseHash);
        assertEq(status, "responded");

        // Record balance of indexer before finalization
        uint256 balanceBefore = indexer1.balance;

        // 4. Finalize Query (Approved)
        vm.prank(requester1);
        registry.finalizeQuery(queryId, true);

        (, , , , , status) = registry.queries(queryId);
        assertEq(status, "completed");

        // Indexer should receive reward
        assertEq(indexer1.balance, balanceBefore + 10 ether);

        // Check scores
        (uint256 positive, uint256 negative) = registry.getIndexerScore(indexer1);
        assertEq(positive, 1);
        assertEq(negative, 0);
    }

    function test_SlashIndexer_Success() public {
        // 1. Register Indexer
        vm.prank(indexer1);
        registry.registerIndexer{value: 100 ether}("https://indexer-celo-1.rindicomfort.io");

        // 2. Slash Indexer by Owner
        uint256 ownerBalanceBefore = owner.balance;

        vm.prank(owner);
        registry.slashIndexer(indexer1);

        (
            ,
            uint256 stake,
            bool active,
            ,
        ) = registry.indexers(indexer1);

        assertEq(stake, 50 ether); // 100 - 50 = 50 ether remaining
        assertFalse(active); // Now deactivated
        assertEq(registry.totalIndexers(), 0);

        // Owner gets slashed funds
        assertEq(owner.balance, ownerBalanceBefore + 50 ether);
    }
}
