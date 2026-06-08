// Celo Dashboard Interactivity & Simulation

// Mock Initial State
let isWalletConnected = false;
let userAddress = "";
let totalIndexersCount = 3;
let activeQueriesCount = 4;
let totalCeloLocked = 210;

let indexersList = [
  { address: "0x1111111111111111111111111111111111111111", endpoint: "https://indexer-celo-1.rindicomfort.io", stake: 100, rating: 100, active: true },
  { address: "0x2222222222222222222222222222222222222222", endpoint: "https://celo-main-node.indexer.net", stake: 120, rating: 98, active: true },
  { address: "0x5555555555555555555555555555555555555555", endpoint: "https://eu-query-celo.theindexer.org", stake: 100, rating: 95, active: false }
];

let queriesList = [
  { id: 1, requester: "0x2222222222222222222222222222222222222222", reward: 10, hash: "0x3ab8...12c9", status: "pending", responder: null },
  { id: 2, requester: "0x5555555555555555555555555555555555555555", reward: 5, hash: "0xe29d...5f21", status: "responded", responder: "0x1111111111111111111111111111111111111111" },
  { id: 3, requester: "0x1111111111111111111111111111111111111111", reward: 25, hash: "0xab12...c098", status: "completed", responder: "0x2222222222222222222222222222222222222222" },
  { id: 4, requester: "0x3333333333333333333333333333333333333333", reward: 15, hash: "0x5f2b...cc43", status: "disputed", responder: "0x1111111111111111111111111111111111111111" }
];

// DOM Elements
const connectBtn = document.getElementById("connect-wallet");
const addressSpan = document.getElementById("wallet-address");
const totalIndexersEl = document.getElementById("total-indexers");
const activeQueriesEl = document.getElementById("active-queries");
const totalStxLockedEl = document.getElementById("total-stx-locked");

const registerForm = document.getElementById("register-form");
const queryForm = document.getElementById("query-form");
const slashForm = document.getElementById("slash-form");

const indexersTableBody = document.getElementById("indexers-table-body");
const queriesTableBody = document.getElementById("queries-table-body");

// Initialize Render
function renderDashboard() {
  // Stats
  totalIndexersEl.textContent = totalIndexersCount;
  activeQueriesEl.textContent = queriesList.filter(q => q.status === "pending" || q.status === "responded").length;
  totalStxLockedEl.textContent = `${totalCeloLocked} CELO`;

  // Render Indexers
  indexersTableBody.innerHTML = "";
  indexersList.forEach(ind => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="wallet-address">${shortenAddress(ind.address)}</span></td>
      <td><code>${ind.endpoint}</code></td>
      <td>${ind.stake} CELO</td>
      <td>${ind.rating}/100</td>
      <td><span class="${ind.active ? 'text-active' : 'text-inactive'}">${ind.active ? 'Active' : 'Inactive'}</span></td>
    `;
    indexersTableBody.appendChild(tr);
  });

  // Render Queries
  queriesTableBody.innerHTML = "";
  queriesList.forEach(q => {
    const tr = document.createElement("tr");
    
    // Determine dynamic actions button based on status
    let actionBtnHTML = "";
    if (q.status === "pending") {
      actionBtnHTML = `<button onclick="simulateResponse(${q.id})" class="btn btn-secondary btn-sm">Process & Respond</button>`;
    } else if (q.status === "responded") {
      actionBtnHTML = `
        <div class="action-buttons-cell">
          <button onclick="finalizeQuery(${q.id}, true)" class="btn btn-accent btn-sm">Approve</button>
          <button onclick="finalizeQuery(${q.id}, false)" class="btn btn-danger btn-sm">Dispute</button>
        </div>
      `;
    } else {
      actionBtnHTML = `<span class="text-inactive">Archived</span>`;
    }

    tr.innerHTML = `
      <td>#${q.id}</td>
      <td><span class="wallet-address">${shortenAddress(q.requester)}</span></td>
      <td>${q.reward} CELO</td>
      <td><span class="status-pill status-${q.status}">${q.status}</span></td>
      <td>${actionBtnHTML}</td>
    `;
    queriesTableBody.appendChild(tr);
  });
}

// Helper: Shorten Address
function shortenAddress(addr) {
  if (addr.length <= 12) return addr;
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
}

// Wallet Connection simulation (MetaMask/EVM)
connectBtn.addEventListener("click", async () => {
  if (!isWalletConnected) {
    if (window.ethereum) {
      try {
        console.log("Requesting EVM wallet account access...");
        // This won't work in model shell, but is standard for real browser Metamask
        // const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        // userAddress = accounts[0];
      } catch (err) {
        console.error("User rejected wallet connection");
      }
    }
    
    // Connect Wallet simulation fallback
    isWalletConnected = true;
    userAddress = "0x9876543210987654321098765432109876543210";
    connectBtn.textContent = "Disconnect";
    addressSpan.textContent = shortenAddress(userAddress);
    addressSpan.classList.remove("hidden");
    console.log("Celo EVM wallet connected (Simulated). Address: " + userAddress);
  } else {
    isWalletConnected = false;
    userAddress = "";
    connectBtn.textContent = "Connect Celo Wallet";
    addressSpan.textContent = "";
    addressSpan.classList.add("hidden");
    console.log("Wallet disconnected.");
  }
});

// Register Indexer
registerForm.addEventListener("submit", (e) => {
  e.preventDefault();
  
  if (!isWalletConnected) {
    alert("Please connect your Celo wallet first.");
    return;
  }

  const endpoint = document.getElementById("endpoint").value;
  const stake = parseInt(document.getElementById("stake-amount").value);

  // Simulation Update
  indexersList.push({
    address: userAddress,
    endpoint: endpoint,
    stake: stake,
    rating: 100,
    active: true
  });

  totalIndexersCount++;
  totalCeloLocked += stake;

  console.log(`[EVM TX] Calling registerIndexer("${endpoint}") with value=${stake} CELO`);
  
  registerForm.reset();
  renderDashboard();
});

// Request Query
queryForm.addEventListener("submit", (e) => {
  e.preventDefault();

  if (!isWalletConnected) {
    alert("Please connect your Celo wallet first.");
    return;
  }

  const hash = document.getElementById("query-target").value;
  const reward = parseInt(document.getElementById("query-reward").value);

  const nextId = queriesList.length + 1;
  queriesList.push({
    id: nextId,
    requester: userAddress,
    reward: reward,
    hash: hash.substring(0, 10) + "...",
    status: "pending",
    responder: null
  });

  totalCeloLocked += reward;

  console.log(`[EVM TX] Calling requestQuery("${hash}") with value=${reward} CELO`);

  queryForm.reset();
  renderDashboard();
});

// Simulate Indexer Node responding to pending query
window.simulateResponse = function(queryId) {
  const query = queriesList.find(q => q.id === queryId);
  if (!query) return;

  // Pick an active indexer to respond
  const activeIndexer = indexersList.find(ind => ind.active) || indexersList[0];
  
  query.status = "responded";
  query.responder = activeIndexer.address;

  console.log(`[Event] Celo Indexer ${activeIndexer.address} submitted response hash for Query ID #${queryId}`);

  renderDashboard();
};

// Finalize Query (Approve / Dispute)
window.finalizeQuery = function(queryId, approved) {
  const query = queriesList.find(q => q.id === queryId);
  if (!query) return;

  if (approved) {
    query.status = "completed";
    totalCeloLocked -= query.reward; // payout to indexer
    console.log(`[EVM TX] Calling finalizeQuery(${queryId}, true). Reward ${query.reward} CELO sent to responder: ${query.responder}`);
  } else {
    query.status = "disputed";
    totalCeloLocked -= query.reward; // refund to requester
    console.log(`[EVM TX] Calling finalizeQuery(${queryId}, false). Reward ${query.reward} CELO refunded to requester: ${query.requester}`);
  }

  renderDashboard();
};

// Owner Slash
slashForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const target = document.getElementById("slash-target").value;
  const indexer = indexersList.find(ind => ind.address.toLowerCase() === target.toLowerCase());

  if (!indexer) {
    alert("Indexer address not found in registry.");
    return;
  }

  if (!indexer.active) {
    alert("Indexer is already inactive.");
    return;
  }

  indexer.active = false;
  const slashedAmount = indexer.stake >= 50 ? 50 : indexer.stake;
  indexer.stake -= slashedAmount;
  totalCeloLocked -= slashedAmount;
  totalIndexersCount--;

  console.log(`[Owner EVM TX] Calling slashIndexer("${target}"). Slashed ${slashedAmount} CELO.`);

  slashForm.reset();
  renderDashboard();
});

// Initial Render
renderDashboard();
