// OSM Station Coordinate Lookup - auto-generated
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CURRENT_COORDS = JSON.parse(fs.readFileSync(path.join(__dirname, "_coords.json"), "utf8"));
const STATION_NAMES = Object.keys(CURRENT_COORDS);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const HEADERS = { "User-Agent": "Troski-App/1.0" };

async function fetchOverpass() {
  console.log("=== Querying Overpass API for bus stops/stations in Greater Accra ===");
  console.log("");
  const query = String.raw`[out:json][timeout:60];(node["highway"="bus_stop"](5.4,-0.5,5.9,0.1);node["amenity"="bus_station"](5.4,-0.5,5.9,0.1);node["public_transport"](5.4,-0.5,5.9,0.1););out body;`;
  const resp = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!resp.ok) { console.error("Overpass error: " + resp.status); return []; }
  const data = await resp.json();
  console.log("Overpass returned " + data.elements.length + " nodes total.");
  console.log("");
  const named = data.elements.filter(e => e.tags && e.tags.name);
  console.log("Named bus stops/stations: " + named.length);
  for (const n of named) {
    const t = n.tags.highway || n.tags.amenity || n.tags.public_transport || "";
    console.log("  [" + n.id + "] " + JSON.stringify(n.tags.name) + " => (" + n.lat + ", " + n.lon + ") type=" + t);
  }
  console.log("");
  return data.elements;
}

async function fetchNominatimTrotro(name) {
  const q = name + " trotro station Accra Ghana";
  const url = "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(q) + "&limit=1";
  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name, type: data[0].type };
  return null;
}

async function fetchNominatimStation(name) {
  const q = name + " station Greater Accra Ghana";
  const url = "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(q) + "&limit=3";
  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.map(d => ({ lat: parseFloat(d.lat), lon: parseFloat(d.lon), display: d.display_name, type: d.type }));
}

async function main() {
  const overpassNodes = await fetchOverpass();
  const overpassByName = {};
  for (const el of overpassNodes) {
    if (!el.tags || !el.tags.name) continue;
    const lname = el.tags.name.toLowerCase();
    if (!overpassByName[lname]) overpassByName[lname] = [];
    overpassByName[lname].push(el);
  }

  function findOverpassMatch(stationName) {
    const lower = stationName.toLowerCase();
    if (overpassByName[lower]) return overpassByName[lower][0];
    for (const [key, nodes] of Object.entries(overpassByName)) {
      if (key.includes(lower) || lower.includes(key)) return nodes[0];
      const clean = lower.replace(/s+station$/, "").replace(/^nkrumahs+/, "");
      if (key.includes(clean) || clean.includes(key)) return nodes[0];
    }
    return null;
  }

  console.log("=== Querying Nominatim for each station (1s delay between requests) ===");
  console.log("");
  const results = {};

  for (const name of STATION_NAMES) {
    process.stdout.write("  Querying: " + name + "...");
    const trotroResult = await fetchNominatimTrotro(name);
    await sleep(1100);
    const stationResults = await fetchNominatimStation(name);
    await sleep(1100);
    const overpassMatch = findOverpassMatch(name);
    results[name] = {
      current: CURRENT_COORDS[name],
      overpass: overpassMatch ? { lat: overpassMatch.lat, lon: overpassMatch.lon, osmName: overpassMatch.tags.name } : null,
      nominatimTrotro: trotroResult,
      nominatimStation: stationResults,
    };
    console.log(" done");
  }

  console.log("");
  console.log("=".repeat(190));
  console.log("STATION COORDINATES COMPARISON");
  console.log("=".repeat(190));
  const header = ["Station".padEnd(20), "Cur Lat".padEnd(10), "Cur Lon".padEnd(10), "Best Lat".padEnd(10), "Best Lon".padEnd(10), "Source".padEnd(16), "Dist(km)".padEnd(10), "Notes"].join(" | ");
  console.log(header);
  console.log("-".repeat(190));
  const recommendations = [];

  for (const name of STATION_NAMES) {
    const r = results[name];
    const cur = r.current;
    let best = null, source = "", notes = "";

    if (r.overpass) {
      best = { lat: r.overpass.lat, lon: r.overpass.lon };
      source = "Overpass";
      notes = "OSM: " + JSON.stringify(r.overpass.osmName);
    }
    if (r.nominatimTrotro) {
      const nt = r.nominatimTrotro;
      if (!best) {
        best = { lat: nt.lat, lon: nt.lon };
        source = "Nom-trotro";
        notes = nt.display ? nt.display.substring(0, 60) : "";
      } else {
        notes += " | Nom-trotro: (" + nt.lat.toFixed(4) + ", " + nt.lon.toFixed(4) + ")";
      }
    }
    if (r.nominatimStation && r.nominatimStation.length > 0) {
      const ns = r.nominatimStation[0];
      if (!best) {
        best = { lat: ns.lat, lon: ns.lon };
        source = "Nom-station";
        notes = ns.display ? ns.display.substring(0, 60) : "";
      } else if (notes.length < 120) {
        notes += " | Nom-sta: (" + ns.lat.toFixed(4) + ", " + ns.lon.toFixed(4) + ")";
      }
    }
    if (!best) {
      best = { lat: cur.latitude, lon: cur.longitude };
      source = "KEEP-current";
      notes = "No OSM match found";
    }

    const dist = haversineKm(cur.latitude, cur.longitude, best.lat, best.lon);
    const row = [
      name.padEnd(20),
      cur.latitude.toFixed(4).padEnd(10),
      cur.longitude.toFixed(4).padEnd(10),
      best.lat.toFixed(4).padEnd(10),
      best.lon.toFixed(4).padEnd(10),
      source.padEnd(16),
      dist.toFixed(3).padEnd(10),
      notes.substring(0, 80)
    ].join(" | ");
    console.log(row);
    recommendations.push({ name, currentLat: cur.latitude, currentLon: cur.longitude, bestLat: best.lat, bestLon: best.lon, source, distKm: dist });
  }
  console.log("-".repeat(190));

  console.log("");
  console.log("=== STATIONS WITH >0.5 km DIFFERENCE ===");
  const diffs = recommendations.filter(r => r.distKm > 0.5 && r.source !== "KEEP-current");
  if (diffs.length === 0) console.log("None! All within 0.5 km.");
  else for (const d of diffs) console.log("  " + d.name + ": " + d.distKm.toFixed(2) + " km off (" + d.currentLat + "," + d.currentLon + " -> " + d.bestLat.toFixed(4) + "," + d.bestLon.toFixed(4) + " via " + d.source + ")");

  console.log("");
  console.log("=== STATIONS WITH 0.1-0.5 km DIFFERENCE ===");
  const minorDiffs = recommendations.filter(r => r.distKm > 0.1 && r.distKm <= 0.5 && r.source !== "KEEP-current");
  if (minorDiffs.length === 0) console.log("None.");
  else for (const d of minorDiffs) console.log("  " + d.name + ": " + d.distKm.toFixed(2) + " km (" + d.currentLat + "," + d.currentLon + " -> " + d.bestLat.toFixed(4) + "," + d.bestLon.toFixed(4) + " via " + d.source + ")");

  console.log("");
  console.log("=== RECOMMENDED COORDINATE UPDATE (TypeScript) ===");
  console.log("// Paste into lib/utils/station-coords.ts");
  console.log("");
  for (const r of recommendations) {
    const useNew = r.distKm > 0.3 && r.source !== "KEEP-current";
    const lat = useNew ? r.bestLat : r.currentLat;
    const lon = useNew ? r.bestLon : r.currentLon;
    const tag = useNew ? ("  // UPDATED from " + r.source + ", was " + r.currentLat + "," + r.currentLon + " (" + r.distKm.toFixed(2) + "km)") : "";
    const q = String.fromCharCode(39);
    const pn = (q + r.name + q + ":").padEnd(26);
    console.log("  " + pn + " { latitude: " + lat.toFixed(4) + ", longitude: " + lon.toFixed(4) + " }," + tag);
  }
}

main().catch(err => { console.error("Fatal error:", err); process.exit(1); });
