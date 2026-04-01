/* -------------------------------------------------------
   CONFIG
------------------------------------------------------- */

const COLORS = {
  Origin: "#ffcc00",
  Domain: "#4f81bd",
  Activity: "#9bbb59",
  Education: "#c0504d",
  Career: "#8064a2",
  Milestone: "#f79646",
  "Life Driver": "#f79646"
};

const ICONS = {
  Origin: "https://img.icons8.com/emoji/48/000000/star-emoji.png",
  Domain: "https://img.icons8.com/fluency/48/000000/compass.png",
  Activity: "https://img.icons8.com/fluency/48/000000/rocket.png",
  Education: "https://img.icons8.com/fluency/48/000000/graduation-cap.png",
  Career: "https://img.icons8.com/fluency/48/000000/briefcase.png",
  Milestone: "https://img.icons8.com/fluency/48/000000/flag.png",
  "Life Driver": "https://img.icons8.com/fluency/48/000000/fire-element.png"
};

let ICONS_ENABLED = false;
let ANIMATIONS_ENABLED = true;

/* -------------------------------------------------------
   NETLIFY CYPHER WRAPPER
------------------------------------------------------- */

async function runCypher(cypher, params = {}) {
  const res = await fetch("/.netlify/functions/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cypher, params })
  });
  return res.json();
}

/* -------------------------------------------------------
   CONVERT NEO4J → VIS FORMAT
------------------------------------------------------- */

function convert(rows) {
  const nodes = {};
  const edges = [];

  rows.forEach(row => {
    const a = row.row[0].properties;
    const r = row.row[1];
    const b = row.row[2].properties;

    nodes[a.id] = {
      id: a.id,
      label: a.name,
      color: COLORS[a.type] || "#999",
      raw: a,
      title: `<strong>${a.name}</strong><br>${a.type}`,
      shape: ICONS_ENABLED ? "image" : "dot",
      image: ICONS_ENABLED ? ICONS[a.type] : null
    };

    nodes[b.id] = {
      id: b.id,
      label: b.name,
      color: COLORS[b.type] || "#999",
      raw: b,
      title: `<strong>${b.name}</strong><br>${b.type}`,
      shape: ICONS_ENABLED ? "image" : "dot",
      image: ICONS_ENABLED ? ICONS[b.type] : null
    };

    edges.push({
      from: a.id,
      to: b.id,
      label: r.type
    });
  });

  return {
    nodes: Object.values(nodes),
    edges
  };
}

/* -------------------------------------------------------
   SIDEBAR
------------------------------------------------------- */

function updateSidebar(node) {
  const box = document.getElementById("node-details");
  box.innerHTML = `
    <div class="detail-item"><strong>Name:</strong> ${node.raw.name}</div>
    <div class="detail-item"><strong>ID:</strong> ${node.raw.id}</div>
    <div class="detail-item"><strong>Type:</strong> ${node.raw.type}</div>
    <div class="detail-item"><strong>Domain:</strong> ${node.raw.domain || "—"}</div>
    <div class="detail-item"><strong>Stage:</strong> ${node.raw.stage || "—"}</div>
    <hr/>
    <div>${node.raw.description || "No description available."}</div>
  `;
}

/* -------------------------------------------------------
   LEGEND
------------------------------------------------------- */

function renderLegend() {
  const legend = document.getElementById("legend");
  legend.innerHTML = Object.keys(ICONS).map(type => `
    <div id="legend-item">
      <img src="${ICONS[type]}"/>
      ${type}
    </div>
  `).join("");
}

/* -------------------------------------------------------
   RADIAL LAYOUT
------------------------------------------------------- */

function applyRadialLayout(data, centerId = "O1") {
  const center = data.nodes.get(centerId);
  if (!center) return;

  const radius = 250;
  const neighbors = data.edges.get().filter(e => e.from === centerId).map(e => e.to);

  neighbors.forEach((id, i) => {
    const angle = (i / neighbors.length) * Math.PI * 2;
    data.nodes.update({
      id,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      fixed: true
    });
  });

  data.nodes.update({ id: centerId, x: 0, y: 0, fixed: true });
}

/* -------------------------------------------------------
   GUIDED MODE
------------------------------------------------------- */

let explorationStep = 0;

async function guidedExplore(network, data) {
  if (explorationStep === 0) {
    const rows = await runCypher(`
      MATCH (o {id: 'O1'})-[r:EXPLORES]->(d:Domain)
      RETURN o, r, d
    `);
    const { nodes, edges } = convert(rows);
    data.nodes.update(nodes);
    data.edges.update(edges);
  }

  if (explorationStep === 1) {
    const rows = await runCypher(`
      MATCH (d:Domain)-[r:CONTAINS]->(a:Activity)
      RETURN d, r, a
    `);
    const { nodes, edges } = convert(rows);
    data.nodes.update(nodes);
    data.edges.update(edges);
  }

  if (explorationStep === 2) {
    const rows = await runCypher(`
      MATCH (a:Activity)-[r:LEADS_TO]->(c:Career)
      RETURN a, r, c
    `);
    const { nodes, edges } = convert(rows);
    data.nodes.update(nodes);
    data.edges.update(edges);
  }

  explorationStep++;

  if (ANIMATIONS_ENABLED) network.stabilize(200);
}

/* -------------------------------------------------------
   INITIAL RENDER
------------------------------------------------------- */

async function renderInitial() {
  const rows = await runCypher(`
    MATCH (o {id: 'O1'})-[r]->(m)
    RETURN o, r, m
  `);

  const { nodes, edges } = convert(rows);

  const container = document.getElementById("graph");
  const data = {
    nodes: new vis.DataSet(nodes),
    edges: new vis.DataSet(edges)
  };

  const network = new vis.Network(container, data, {
    nodes: {
      shape: "dot",
      size: 18,
      font: { color: "#222", size: 14 }
    },
    edges: {
      arrows: "to",
      color: "#bbb",
      font: { color: "#999", size: 8 },
      smooth: { type: "dynamic" }
    },
    physics: { stabilization: true },
    interaction: { hover: true }
  });

  /* -------------------------
     CLICK TO EXPAND
  ------------------------- */
  network.on("click", async params => {
    if (!params.nodes.length) return;

    const id = params.nodes[0];
    const node = data.nodes.get(id);
    updateSidebar(node);

    const rows = await runCypher(`
      MATCH (n {id: $id})-[r]->(m)
      RETURN n, r, m
    `, { id });

    const { nodes: newNodes, edges: newEdges } = convert(rows);

    data.nodes.update(newNodes);
    data.edges.update(newEdges);

    if (ANIMATIONS_ENABLED) network.stabilize(200);
  });

  /* -------------------------
     TOGGLE BUTTONS
  ------------------------- */

  document.getElementById("toggle-icons").onclick = () => {
    ICONS_ENABLED = !ICONS_ENABLED;
    const updated = data.nodes.get().map(n => ({
      id: n.id,
      shape: ICONS_ENABLED ? "image" : "dot",
      image: ICONS_ENABLED ? ICONS[n.raw.type] : null
    }));
    data.nodes.update(updated);
  };

  document.getElementById("toggle-legend").onclick = () => {
    const legend = document.getElementById("legend");
    legend.style.display = legend.style.display === "none" ? "block" : "none";
  };

  document.getElementById("toggle-radial").onclick = () => {
    applyRadialLayout(data);
    if (ANIMATIONS_ENABLED) network.stabilize(200);
  };

  document.getElementById("guided-mode").onclick = () => {
    guidedExplore(network, data);
  };

  document.getElementById("toggle-anim").onclick = () => {
    ANIMATIONS_ENABLED = !ANIMATIONS_ENABLED;
  };

  renderLegend();
}

renderInitial();
