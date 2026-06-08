const { ethers } = require("ethers");

// Configuration
const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://alfajores-forno.celo-testnet.org"; // Alfajores testnet default
const INDEXER_PRIVATE_KEY = process.env.INDEXER_PRIVATE_KEY || "0x0123456789012345678901234567890123456789012345678901234567890123"; // Mock key
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

// ABI of IndexerRegistry
const CONTRACT_ABI = [
  "event QueryRequested(uint256 indexed queryId, address indexed requester, bytes32 queryHash, uint256 reward)",
  "function submitResponse(uint256 queryId, bytes32 responseHash) external"
];

async function runIndexerNode() {
  console.log("=========================================");
  console.log("       The Indexer - Celo Node           ");
  console.log(`       Author: rindicomfort              `);
  console.log("=========================================");
  console.log(`Connecting to Celo RPC: ${CELO_RPC_URL}`);
  console.log(`Registry Contract: ${CONTRACT_ADDRESS}`);
  console.log("Indexer Node started. Listening for query requests...");

  if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.log("\n[WARNING] Contract address is unset. Running in simulated test mode.");
    
    // Simulating block scanning
    setInterval(() => {
      const mockQueryId = Math.floor(Math.random() * 100) + 1;
      console.log(`\n[${new Date().toISOString()}] New QueryRequested Event Detected on Celo:`);
      console.log(`  - Query ID: ${mockQueryId}`);
      console.log(`  - Requester: 0x3333333333333333333333333333333333333333`);
      console.log(`  - Query Hash: 0x5a2d... (EVM compatible bytes32)`);
      
      console.log(`[ID #${mockQueryId}] Reading block transactions and calculating indexing result...`);
      const responseDataHash = ethers.keccak256(ethers.toUtf8Bytes(`celo-response-data-for-${mockQueryId}`));
      console.log(`[ID #${mockQueryId}] Generated response hash: ${responseDataHash}`);
      console.log(`[ID #${mockQueryId}] Mock Broadcast Success! (Celo submitResponse transacted)`);
    }, 10000);
    return;
  }

  // Real connection setup
  const provider = new ethers.JsonRpcProvider(CELO_RPC_URL);
  const wallet = new ethers.Wallet(INDEXER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

  // Subscribe to event
  contract.on("QueryRequested", async (queryId, requester, queryHash, reward, event) => {
    console.log(`\n[EVENT] QueryRequested: ID #${queryId.toString()}`);
    console.log(`  Requester: ${requester}`);
    console.log(`  Reward: ${ethers.formatEther(reward)} CELO`);
    
    try {
      console.log(`[ID #${queryId}] Indexing event...`);
      // Mock result hash computation
      const responseHash = ethers.keccak256(ethers.toUtf8Bytes(`celo-response-data-for-${queryId}`));

      console.log(`[ID #${queryId}] Submitting response on-chain...`);
      const tx = await contract.submitResponse(queryId, responseHash);
      console.log(`[ID #${queryId}] Transaction broadcasted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`[ID #${queryId}] Transaction confirmed in block ${receipt.blockNumber}`);
    } catch (err) {
      console.error(`Error processing query ${queryId}:`, err);
    }
  });
}

runIndexerNode().catch(console.error);
