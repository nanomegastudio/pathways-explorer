// -------------------------------
// CONFIGURATION
// -------------------------------
const DATA_API_URL = "YOUR_DATA_API_URL"; 
const API_KEY = "YOUR_DATA_API_KEY";

// Node colors mapped to the "type" field in your CSVs
const COLORS = {
  Origin: "#ffcc00",       // Discovery Phase
  Domain: "#4f81bd",       // STEM, Humanities, etc.
  Activity: "#9bbb59",     // Coding, Dance, etc.
  Education: "#c0504d",    // University Degrees
  Career: "#8064a2",       // Professional Roles
  Milestone: "#f79646"     // Life Events
};

// -------------------------------
// DATA API HELPER
// -------------------------------
async function runCypher(cypher, params = {}) {
  const response = await fetch("/.netlify/functions/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cypher, params })
  });

  return await response.json();
}


// -------------------------------
// GRAPH INITIALIZATION
// -------------------------------
const graphElem = document.getElementById("graph");
let graphData = { nodes: [], links: [] };

const Graph = ForceGraph()(graphElem)
  .nodeId("id")
  // Accessing 'name' and 'type' from the properties of your CSV nodes
  .nodeLabel(node => `<strong>${node.name}</strong><br/><em>${node.type}</em><br/>${node.description || ''}`)
  .nodeColor(node => COLORS[node.type] || "#999")
  .linkDirectionalArrowLength(4)
  .linkDirectionalArrowRelPos(1)
  .linkLabel(link => link.relationship)
  .onNodeClick(handleNodeClick);

// -------------------------------
// LOAD INITIAL GRAPH
// -------------------------------
loadInitial();

async function loadInitial() {
  // Matches the Origin and the first layer of life drivers/major domains
  const cypher = `
    MATCH (o {type: 'Origin'})-[r:EXPLORES|INFLUENCES]->(m)
    RETURN o, r, m
  `;

  const rows = await runCypher(cypher);
  graphData = convertToGraph(rows);
  Graph.graphData(graphData);
}

// -------------------------------
// CLICK TO EXPAND
// -------------------------------
async function handleNodeClick(node) {
  updateSidebar(node);

  // This query finds all nodes connected to the clicked node.
  // It handles the specific relationship types used in your files (PREPARES, LEADS_TO, etc.)
  const cypher = `
    MATCH (n {id: $id})-[r]->(m)
    RETURN n, r, m
  `;

  const rows = await runCypher(cypher, { id: node.id });
  const newData = convertToGraph(rows);

  mergeGraphData(newData);
  Graph.graphData(graphData);
}

// -------------------------------
// GRAPH HELPERS
// -------------------------------
function convertToGraph(rows) {
  const nodes = [];
  const links = [];

  rows.forEach(row => {
    // Neo4j REST API returns objects in row[0], row[1], row[2]
    const n = row.row[0]; // Start Node
    const r = row.row[1]; // Relationship
    const m = row.row[2]; // End Node

    if (n && !nodes.find(x => x.id === n.id)) nodes.push(n);
    if (m && !nodes.find(x => x.id === m.id)) nodes.push(m);

    if (r) {
      links.push({
        source: n.id,
        target: m.id,
        relationship: r.relationship || r.type // Uses your CSV relationship field
      });
    }
  });

  return { nodes, links };
}

function mergeGraphData(newData) {
  newData.nodes.forEach(n => {
    if (!graphData.nodes.find(x => x.id === n.id)) {
      graphData.nodes.push(n);
    }
  });

  newData.links.forEach(l => {
    if (!graphData.links.find(x => x.source === l.source && x.target === l.target)) {
      graphData.links.push(l);
    }
  });
}

// -------------------------------
// SIDEBAR
// -------------------------------
function updateSidebar(node) {
  const box = document.getElementById("node-details-content");
  
  // Directly maps to the columns in your CSV files
  box.innerHTML = `
    <div class="detail-item"><strong>Name:</strong> ${node.name}</div>
    <div class="detail-item"><strong>ID:</strong> ${node.id}</div>
    <div class="detail-item"><strong>Type:</strong> ${node.type}</div>
    <div class="detail-item"><strong>Domain:</strong> ${node.domain}</div>
    <div class="detail-item"><strong>Stage:</strong> ${node.stage}</div>
    <hr/>
    <div class="detail-description">${node.description || "No description available."}</div>
  `;
}