/* River basins of Lebanon - dashboard
   Data from python/05_export_web.py (web/data/). No build step: Leaflet + Chart.js from cdnjs. */

const FOCUS = "#D35400";
const STREAM = { 3: ["#6FA6D6", 0.8], 4: ["#2366A8", 1.4], 5: ["#123F73", 2.2], 6: ["#123F73", 3.0] };
const RAMP = ["#F6EEE3", "#E9D3B4", "#D6AF7E", "#B9834B", "#8C5A2B"];   // earth tones, light -> dark
const ORDER_COL = { 1: "#B7D4EC", 2: "#B7D4EC", 3: "#6FA6D6", 4: "#2366A8", 5: "#123F73", 6: "#123F73" };

const fmt = (v, d = 0) => (v == null || isNaN(v)) ? "–" :
  Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const STAT_ROWS = [
  ["Area", "area_km2", 0, " km²"], ["Perimeter", "perim_km", 0, " km"],
  ["Main river", "main_len_km", 1, " km"], ["Stream length", "stream_len_km", 0, " km"],
  ["Drainage density", "dd_km_km2", 2, " km/km²"], ["Max Strahler order", "max_order", 0, ""],
  ["Lowest point", "elev_min_m", 0, " m"], ["Highest point", "elev_max_m", 0, " m"],
  ["Mean elevation", "elev_mean_m", 0, " m"], ["Relief", "relief_m", 0, " m"],
  ["Hypsometric integral", "hi", 3, ""], ["Relief ratio", "relief_ratio", 4, ""],
  ["Form factor", "form_factor", 3, ""], ["Circularity", "circularity", 3, ""],
  ["Elongation", "elongation", 3, ""],
];

let map, basinLayer, townLayer, records = {}, selected = null, metric = "", breaks = [];
let hypsoChart, orderChart;

async function getJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

async function init() {
  const [basins, streams, towns, lebanon, recs] = await Promise.all([
    getJSON("data/basins.geojson"), getJSON("data/streams.geojson"),
    getJSON("data/towns.geojson"), getJSON("data/lebanon.geojson"), getJSON("data/basins.json")]);
  recs.forEach(r => { records[r.basin_id] = r; });

  map = L.map("map", { zoomSnap: 0.25, attributionControl: true });
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 16, attribution: "Basemap: Esri, HERE, Garmin, © OpenStreetMap contributors" }).addTo(map);

  basinLayer = L.geoJSON(basins, {
    style: basinStyle,
    onEachFeature: (f, layer) => {
      layer.bindTooltip(`<b>${f.properties.name}</b><br>${fmt(f.properties.area_km2)} km²`,
        { sticky: true, className: "basin-tip" });
      layer.on({
        mouseover: e => { if (f.properties.basin_id !== selected) e.target.setStyle({ weight: 2, color: FOCUS, fillOpacity: fillOpacity(f) + 0.15 }); },
        mouseout: e => basinLayer.resetStyle(e.target),
        click: () => select(f.properties.basin_id, true),
      });
    },
  }).addTo(map);

  L.geoJSON(streams, {
    interactive: false,
    style: f => { const [c, w] = STREAM[f.properties.order] || STREAM[6]; return { color: c, weight: w, opacity: 0.9 }; },
  }).addTo(map);

  L.geoJSON(lebanon, { interactive: false, style: { color: "#3A3A3A", weight: 1.4, dashArray: "6 4", opacity: 0.9 } }).addTo(map);

  townLayer = L.geoJSON(towns, {
    pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 3.5, color: "#FFFFFF", weight: 1, fillColor: "#333333", fillOpacity: 1 })
      .bindTooltip(f.properties.name, { permanent: true, direction: "right", offset: [4, 0], className: "town-tip" }),
    filter: () => false,              // shown for the selected basin only
  }).addTo(map);
  townLayer._all = towns;

  map.fitBounds(basinLayer.getBounds(), { padding: [10, 10] });

  kpis(recs);
  table(recs);
  document.getElementById("metric").addEventListener("change", e => { metric = e.target.value; recolour(); });

  const fromHash = parseInt(location.hash.replace("#", ""), 10);   // e.g. #12 = El Litani
  if (records[fromHash]) select(fromHash, true);
}

/* ---------- styling ---------- */
function fillOpacity(f) { return metric ? 0.75 : 0.18; }
function fillColour(f) {
  if (!metric) return "#FFFFFF";
  const v = records[f.properties.basin_id][metric];
  let i = 0; while (i < breaks.length && v > breaks[i]) i++;
  return RAMP[Math.min(i, RAMP.length - 1)];
}
function basinStyle(f) {
  const sel = f.properties.basin_id === selected;
  return { color: sel ? FOCUS : "#6E6E6E", weight: sel ? 3 : 0.8, fillColor: fillColour(f),
           fillOpacity: fillOpacity(f) };
}
function recolour() {
  const ramp = document.getElementById("ramp");
  if (metric) {
    const vals = Object.values(records).map(r => r[metric]).sort((a, b) => a - b);
    breaks = [1, 2, 3, 4].map(k => vals[Math.round(k * (vals.length - 1) / 5)]);   // quintiles
    const d = metric === "hi" || metric === "elongation" ? 2 : metric === "dd_km_km2" ? 2 : 0;
    ramp.innerHTML = `<div class="bar">${RAMP.map(c => `<span style="background:${c}"></span>`).join("")}</div>
      <div class="ends"><span>${fmt(vals[0], d)}</span><span>${fmt(vals[vals.length - 1], d)}</span></div>`;
    ramp.hidden = false;
  } else { ramp.hidden = true; }
  basinLayer.setStyle(basinStyle);
}

/* ---------- selection ---------- */
function select(id, zoom) {
  selected = id;
  const r = records[id];
  basinLayer.setStyle(basinStyle);
  basinLayer.eachLayer(l => { if (l.feature.properties.basin_id === id) { l.bringToFront(); if (zoom) map.flyToBounds(l.getBounds(), { padding: [30, 30], duration: 0.6 }); } });

  townLayer.clearLayers();
  townLayer.options.filter = f => f.properties.basin_id === id;
  townLayer.addData(townLayer._all);

  document.getElementById("intro").hidden = true;
  document.getElementById("detail").hidden = false;
  document.getElementById("d-sheet").textContent = `Atlas sheet ${r.sheet} of 16`;
  document.getElementById("d-name").textContent = `${r.name} basin`;
  document.getElementById("d-stats").innerHTML = STAT_ROWS.map(([lab, k, d, u]) =>
    `<div><dt>${lab}</dt><dd>${fmt(r[k], d)}${u}</dd></div>`).join("");
  const link = document.getElementById("d-sheet-link");
  link.href = r.image;
  const img = document.getElementById("d-img");
  img.src = r.image; img.alt = `Atlas sheet of the ${r.name} basin`;

  charts(r);
  document.querySelectorAll("#table tbody tr").forEach(tr => tr.classList.toggle("sel", +tr.dataset.id === id));
  history.replaceState(null, "", `#${id}`);
}

/* ---------- charts ---------- */
function charts(r) {
  const h = r.hypsometry;
  const pts = h.rel_height.map((y, i) => ({ x: h.rel_area[i], y }));
  const base = { responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
                 plugins: { legend: { display: false } } };
  const axis = t => ({ title: { display: true, text: t, color: "#5A5A5A", font: { size: 11 } },
                       grid: { color: "#EEE9E0" }, ticks: { color: "#5A5A5A", font: { size: 11 } } });
  if (hypsoChart) hypsoChart.destroy();
  hypsoChart = new Chart(document.getElementById("c-hypso"), {
    type: "scatter",                                  // x runs 1 -> 0: scatter + showLine, not a line chart
    data: { datasets: [
      { data: pts, showLine: true, borderColor: FOCUS, backgroundColor: "rgba(211,84,0,.12)", fill: "origin", pointRadius: 0, borderWidth: 2, tension: 0.2 },
      { data: [{ x: 0, y: 1 }, { x: 1, y: 0 }], showLine: true, borderColor: "#B5B5B5", borderDash: [4, 4], pointRadius: 0, borderWidth: 1 } ] },
    options: { ...base, parsing: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: c => c.datasetIndex ? "" : `${fmt(c.parsed.x * 100)} % of the area above ${fmt(c.parsed.y * 100)} % of the relief` } } },
      scales: { x: { type: "linear", min: 0, max: 1, ...axis("Relative area (a/A)") },
                y: { min: 0, max: 1, ...axis("Relative height (h/H)") } } },
  });
  if (orderChart) orderChart.destroy();
  orderChart = new Chart(document.getElementById("c-orders"), {
    type: "bar",
    data: { labels: r.stream_orders.map(o => `Order ${o.order}`),
            datasets: [{ data: r.stream_orders.map(o => o.length_km),
                         backgroundColor: r.stream_orders.map(o => ORDER_COL[o.order] || "#123F73") }] },
    options: { ...base,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: c => `${fmt(c.parsed.y, 1)} km, ${r.stream_orders[c.dataIndex].segments} segments` } } },
      scales: { x: { grid: { display: false }, ticks: { color: "#5A5A5A", font: { size: 11 } } },
                y: axis("Length (km)") } },
  });
}

/* ---------- overview numbers ---------- */
function kpis(recs) {
  const by = k => recs.reduce((a, b) => (b[k] > a[k] ? b : a));
  const total = recs.reduce((s, r) => s + r.area_km2, 0);
  const items = [
    [fmt(total), "km² in 16 basins"],
    [by("area_km2").name, `largest, ${fmt(by("area_km2").area_km2)} km²`],
    [by("relief_m").name, `highest relief, ${fmt(by("relief_m").relief_m)} m`],
    [by("hi").name, `youngest relief, HI ${fmt(by("hi").hi, 2)}`],
  ];
  document.getElementById("kpis").innerHTML = items.map(([b, s]) => `<div class="kpi"><b>${b}</b><span>${s}</span></div>`).join("");
}

/* ---------- table ---------- */
let sortKey = "sheet", asc = true;
function table(recs) {
  const tbody = document.querySelector("#table tbody");
  const cols = [["sheet", 0], ["name"], ["area_km2", 0], ["main_len_km", 1], ["dd_km_km2", 2],
                ["relief_m", 0], ["elev_mean_m", 0], ["hi", 3], ["elongation", 2], ["max_order", 0]];
  const draw = () => {
    const rows = [...recs].sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * (asc ? 1 : -1);
    });
    tbody.innerHTML = rows.map(r => `<tr data-id="${r.basin_id}" class="${r.basin_id === selected ? "sel" : ""}">` +
      cols.map(([k, d]) => `<td>${d === undefined ? r[k] : fmt(r[k], d)}</td>`).join("") + "</tr>").join("");
    document.querySelectorAll("#table th").forEach(th => {
      th.classList.toggle("sorted", th.dataset.k === sortKey);
      th.classList.toggle("asc", th.dataset.k === sortKey && asc);
    });
  };
  document.querySelectorAll("#table th").forEach(th => th.addEventListener("click", () => {
    if (sortKey === th.dataset.k) asc = !asc; else { sortKey = th.dataset.k; asc = th.dataset.t === "s"; }
    draw();
  }));
  tbody.addEventListener("click", e => {
    const tr = e.target.closest("tr"); if (!tr) return;
    select(+tr.dataset.id, true);
    document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  draw();
}

init().catch(err => {
  document.getElementById("map").innerHTML =
    `<p style="padding:16px">Could not load the data (${err.message}). Open the page through a web server, not as a file.</p>`;
});
