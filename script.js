// -------------------------------
// CONFIGURATION
// -------------------------------

// These are not used anymore (Data API disabled), but keeping them for clarity
const DATA_API_URL = "UNUSED";
const API_KEY = "UNUSED";

// Node colors mapped to the "type" field in your CSVs
const COLORS = {
  Origin: "#ffcc00",
  Domain: "#4f81bd",
  Activity: "#9bbb59",
  Education: "#c0504d",
  Career: "#8064a2",
  Milestone: "#f79646"
};

// -------------------------------
// DEBUG PANEL
// -------------------------------
function debugLog(...args) {
  console.log(...args);
  const box = document.getElementById("debug");
  if (!box) return;
  box.textContent += args.map(a => JSON.stringify(a, null, 2)).join(" ") + "\n";
}

// -------------------------------
// DATA API HELPER (via Netlify)
// -------------------------------
async function runCypher(cypher, params = {}) {
  debugLog("RUN CYPHER:", cypher, params);

  let response;
  try {
    response = await fetch("/.netlify/functions/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cypher, params })
    });
  } catch (err) {
    debugLog("NETWORK ERROR calling Netlify function:", err);
    return null;
  }

  debugLog("FUNCTION RESPONSE STATUS:", response.status);

  let json;
  try {
    json = await response.json();
  } catch (err) {
    debugLog("JSON PARSE ERROR:", err);
    return null;
  }

  debugLog("FUNCTION RESPONSE JSON:", json);
  return json;
}

// -------------------------------
// GRAPH INITIALIZATION
// -------------------------------
const graphElem = document.getElementById("graph");
let graphData = { nodes: [], links: [] };

const Graph = ForceGraph()(graphElem)
  .nodeId("id")
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
  const cypher = `
    MATCH (o {id: 'O1'})-[r:EXPLORES|INFLUENCES]->(m)
    RETURN o, r, m
  `;

  const rows = await runCypher(cypher);

  if (!rows) {
    debugLog("ERROR: No rows returned from initial query.");
    return;
  }

  if (!Array.isArray(rows)) {
    debugLog("ERROR: rows is not an array:", rows);
    return;
  }

  graphData = convertToGraph(rows);
  debugLog("INITIAL GRAPH DATA:", graphData);

  Graph.graphData(graphData);
}

// -------------------------------
// CLICK TO EXPAND
// -------------------------------
async function handleNodeClick(node) {
  updateSidebar(node);

  const cypher = `
    MATCH (n {id: $id})-[r]->(m)
    RETURN n, r, m
  `;

  const rows = await runCypher(cypher, { id: node.id });

  if (!rows) {
    debugLog("ERROR: No rows returned for click expansion.");
    return;
  }

  if (!Array.isArray(rows)) {
    debugLog("ERROR: rows is not an array:", rows);
    return;
  }

  const newData = convertToGraph(rows);
  debugLog("EXPANDED GRAPH DATA:", newData);

  mergeGraphData(newData);
  Graph.graphData(graphData);
}

// -------------------------------
// GRAPH HELPERS
// -------------------------------
function convertToGraph(rows) {
  debugLog("CONVERT TO GRAPH — INPUT ROWS:", rows);

  const nodes = [];
  const links = [];

  rows.forEach((row, index) => {
    if (!row || !row.row) {
      debugLog(`WARNING: Row ${index} missing .row property:`, row);
      return;
    }

    const n = row.row[0];
    const r = row.row[1];
    const m = row.row[2];

    if (!n || !m) {
      debugLog(`WARNING: Row ${index} missing node data:`, row);
      return;
    }

    if (!nodes.find(x => x.id === n.id)) nodes.push(n);
    if (!nodes.find(x => x.id === m.id)) nodes.push(m);

    if (r) {
      links.push({
        source: n.id,
        target: m.id,
        relationship: r.relationship || r.type || "UNKNOWN"
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
