// -------------------------------
// CONFIGURATION
// -------------------------------
const COLORS = {
  Origin: "#ffcc00",
  Domain: "#4f81bd",
  Activity: "#9bbb59",
  Education: "#c0504d",
  Career: "#8064a2",
  Milestone: "#f79646",
  "Life Driver": "#f79646"
};

let Graph;
let graphData = { nodes: [], links: [] };

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
// RUN CYPHER THROUGH NETLIFY
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
    debugLog("NETWORK ERROR:", err);
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
// FORCEGRAPH INITIALIZATION
// -------------------------------
window.addEventListener("load", () => {
  debugLog("WINDOW LOADED — initializing graph");

  const graphElem = document.getElementById("graph");

  debugLog("GRAPH ELEMENT SIZE AT INIT:", graphElem.offsetWidth, graphElem.offsetHeight);
  debugLog("ForceGraph loaded?", typeof ForceGraph);

  Graph = ForceGraph()(graphElem)
    .nodeId("id")
    .linkSource("source")   // ← CRITICAL FIX
    .linkTarget("target")   // ← CRITICAL FIX
    .nodeLabel(node => `<strong>${node.name}</strong><br/><em>${node.type}</em>`)
    .nodeColor(node => COLORS[node.type] || "#999")
    .linkDirectionalArrowLength(4)
    .linkDirectionalArrowRelPos(1)
    .linkLabel(link => link.relationship)
    .onNodeClick(handleNodeClick);

  Graph.width(graphElem.offsetWidth);
  Graph.height(graphElem.offsetHeight);

  loadInitial();
});

// -------------------------------
// LOAD INITIAL GRAPH
// -------------------------------
async function loadInitial() {
  const cypher = `
    MATCH (o {id: 'O1'})-[r:EXPLORES|INFLUENCES]->(m)
    RETURN o, r, m
  `;

  const rows = await runCypher(cypher);

  if (!rows || !Array.isArray(rows)) {
    debugLog("ERROR: rows is not an array:", rows);
    return;
  }

  graphData = convertToGraph(rows);
  debugLog("INITIAL GRAPH DATA:", graphData);

  const graphElem = document.getElementById("graph");
  debugLog("GRAPH ELEMENT SIZE BEFORE RENDER:", graphElem.offsetWidth, graphElem.offsetHeight);

  Graph.graphData(graphData);
  Graph.zoomToFit(400, 50);

  setTimeout(() => {
    debugLog("GRAPH ELEMENT SIZE BEFORE RESIZE:", graphElem.offsetWidth, graphElem.offsetHeight);
    window.dispatchEvent(new Event("resize"));
    debugLog("GRAPH ELEMENT SIZE AFTER RESIZE:", graphElem.offsetWidth, graphElem.offsetHeight);
  }, 500);
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

  if (!rows || !Array.isArray(rows)) {
    debugLog("ERROR: rows is not an array:", rows);
    return;
  }

  const newData = convertToGraph(rows);
  debugLog("EXPANDED GRAPH DATA:", newData);

  mergeGraphData(newData);
  Graph.graphData(graphData);
  Graph.zoomToFit(400, 50);
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

    const startNode = {
      id: n.properties.id,
      name: n.properties.name,
      type: n.properties.type,
      domain: n.properties.domain,
      stage: n.properties.stage,
      description: n.properties.description
    };

    const endNode = {
      id: m.properties.id,
      name: m.properties.name,
      type: m.properties.type,
      domain: m.properties.domain,
      stage: m.properties.stage,
      description: m.properties.description
    };

    if (!nodes.find(x => x.id === startNode.id)) nodes.push(startNode);
    if (!nodes.find(x => x.id === endNode.id)) nodes.push(endNode);

    links.push({
      source: startNode.id,
      target: endNode.id,
      relationship: r.properties?.relationship || r.type
    });
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
