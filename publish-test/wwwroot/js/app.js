const API_BASE = ""; // same origin, leave empty; or set full Render URL if UI is hosted separately

// --- Asset catalog table: loads all assets (Data/sample-data.csv via API), read-only,
// and runs predictions for all of them together instead of one at a time. ---
let assetCatalog = [];              // rows returned by /api/assets/catalog
const predictionResults = {};       // AssetId -> prediction result from /api/prediction/predict

const priorityColors = { Critical: "danger", High: "warning", Medium: "info", Low: "success" };
const fireColors = { Extreme: "danger", High: "warning", Moderate: "info", Low: "success" };

async function loadAssetCatalog() {
    const statusDiv = document.getElementById("catalogStatus");
    const tbody = document.getElementById("assetCatalogTableBody");

    try {
        const res = await fetch(`${API_BASE}/api/assets/catalog`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        assetCatalog = await res.json();
        renderCatalogTable();
    } catch (err) {
        console.error("Could not load asset catalog:", err);
        if (statusDiv) {
            statusDiv.classList.remove("d-none");
            statusDiv.textContent = "Could not load assets — check /api/assets/catalog";
        }
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="12" class="text-center text-danger">Could not load assets.</td></tr>`;
        }
    }
}

function renderCatalogTable() {
    const tbody = document.getElementById("assetCatalogTableBody");
    if (!tbody) return;

    if (assetCatalog.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-center text-muted">No assets found.</td></tr>`;
        return;
    }

    tbody.innerHTML = assetCatalog.map(asset => {
        const result = predictionResults[asset.AssetId];

        const tempCell = result ? `<i class="bi bi-thermometer-half text-danger me-1"></i>${result.temperatureC.toFixed(1)}°F` : `<span class="text-muted">—</span>`;
        const windCell = result ? `<i class="bi bi-wind text-primary me-1"></i>${result.windSpeedKph.toFixed(1)} miles/h` : `<span class="text-muted">—</span>`;
        const precipCell = result ? `<i class="bi bi-cloud-rain text-info me-1"></i>${result.precipitationMm.toFixed(1)} mm` : `<span class="text-muted">—</span>`;

        const priorityCell = result
            ? `<span class="badge bg-${priorityColors[result.priorityLevel] || "secondary"}">${result.priorityLevel} (${result.priorityScore.toFixed(0)})</span>`
            : `<span class="text-muted">—</span>`;

        const maintenanceCell = result
            ? (result.needsMaintenance ? "⚠️ Yes" : "OK")
            : `<span class="text-muted">—</span>`;

        const fireCell = result
            ? `<span class="badge bg-${fireColors[result.fireDangerRating] || "secondary"}">${result.fireDangerRating}</span>`
            : `<span class="text-muted">—</span>`;

        return `
            <tr data-asset-id="${asset.AssetId}">
                <td>${asset.AssetId}</td>
                <td>${asset.AssetType}</td>
                <td>${asset.Latitude}</td>
                <td>${asset.Longitude}</td>
                <td>${asset.AgeYears}</td>
                <td>${asset.LastInspectionMonthsAgo}</td>
                <td class="temp-cell">${tempCell}</td>
                <td class="wind-cell">${windCell}</td>
                <td class="precip-cell">${precipCell}</td>
                <td class="priority-cell">${priorityCell}</td>
                <td class="maintenance-cell">${maintenanceCell}</td>
                <td class="fire-cell">${fireCell}</td>
            </tr>
        `;
    }).join("");
}

function setRowPredicting(assetId) {
    const row = document.querySelector(`#assetCatalogTableBody tr[data-asset-id="${assetId}"]`);
    if (!row) return;
    row.querySelector(".temp-cell").innerHTML = `<span class="text-muted">...</span>`;
    row.querySelector(".wind-cell").innerHTML = "";
    row.querySelector(".precip-cell").innerHTML = "";
    row.querySelector(".priority-cell").innerHTML = `<span class="text-muted">Predicting...</span>`;
    row.querySelector(".maintenance-cell").innerHTML = "";
    row.querySelector(".fire-cell").innerHTML = "";
}

function setRowError(assetId) {
    const row = document.querySelector(`#assetCatalogTableBody tr[data-asset-id="${assetId}"]`);
    if (!row) return;
    row.querySelector(".priority-cell").innerHTML = `<span class="text-danger">Error</span>`;
}

async function runPredictionForAsset(asset) {
    setRowPredicting(asset.AssetId);

    const payload = {
        assetId: asset.AssetId,
        assetType: asset.AssetType,
        latitude: parseFloat(asset.Latitude),
        longitude: parseFloat(asset.Longitude),
        ageYears: parseFloat(asset.AgeYears),
        lastInspectionMonthsAgo: parseFloat(asset.LastInspectionMonthsAgo)
    };

    try {
        const res = await fetch(`${API_BASE}/api/prediction/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        predictionResults[asset.AssetId] = data;
        renderCatalogTable();

        addMarker(payload.latitude, payload.longitude, payload.assetId, data.needsMaintenance);
        logAssetForRouting(payload, data);
    } catch (err) {
        console.error(`Prediction failed for ${asset.AssetId}:`, err);
        setRowError(asset.AssetId);
    }
}

async function runAllPredictions() {
    const btn = document.getElementById("runAllPredictionsBtn");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Running...`;
    }

    for (const asset of assetCatalog) {
        await runPredictionForAsset(asset);
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-lightning-fill me-1"></i> Run All Predictions`;
    }
}

document.addEventListener("DOMContentLoaded", loadAssetCatalog);

document.getElementById("runAllPredictionsBtn").addEventListener("click", runAllPredictions);

// --- Image form ---
document.getElementById("imageForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("imageFile");
    const file = fileInput.files[0];
    const expectedType = document.getElementById("expectedAssetType").value;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("expectedAssetType", expectedType);

    const panel = document.getElementById("imageAnalysisPanel");
    const resultPanel = document.getElementById("imageResultPanel");
    const detectionsPanel = document.getElementById("detectionsPanel");

    panel.classList.remove("d-none");
    resultPanel.textContent = "Classifying...";
    detectionsPanel.innerHTML = "";

    try {
        const res = await fetch(`${API_BASE}/api/image/predict`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();

        // Draw the image + bounding boxes
        const img = new Image();
        img.onload = () => {
            const canvas = document.getElementById("imageCanvas");
            canvas.classList.remove("d-none");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            ctx.lineWidth = 4;
            ctx.font = "24px sans-serif";
            ctx.textBaseline = "top";

            data.detections.forEach(d => {
                const boxX = d.x - d.width / 2;
                const boxY = d.y - d.height / 2;

                ctx.strokeStyle = "#00c853";
                ctx.strokeRect(boxX, boxY, d.width, d.height);

                const label = `${d.class} ${(d.confidence * 100).toFixed(0)}%`;
                const textWidth = ctx.measureText(label).width;
                ctx.fillStyle = "#00c853";
                ctx.fillRect(boxX, boxY - 28, textWidth + 10, 28);
                ctx.fillStyle = "#fff";
                ctx.fillText(label, boxX + 5, boxY - 26);
            });
        };
        img.src = URL.createObjectURL(file);

        if (data.detectionCount === 0) {
            resultPanel.textContent = "No findings detected in this photo.";
            detectionsPanel.innerHTML = "";
            return;
        }

        let html = "<ul>";
        data.detections.forEach(det => {
            const name = det.label || det.class || "Unknown";
            const score = det.confidence || 0;
            html += `<li>${name} — ${(score * 100).toFixed(2)}%</li>`;
        });
        html += "</ul>";

        resultPanel.textContent = "Asset Discrepancy:";
        detectionsPanel.innerHTML = html;

    } catch (err) {
        resultPanel.textContent = "Error: " + err.message;
    }
});

// --- Map setup ---
const map = L.map("map").setView([37.9101, -122.0652], 13);

// California bounding box
const californiaBounds = L.latLngBounds(
    [32.5, -124.5],   // Southwest corner
    [42.1, -114.1]    // Northeast corner
);

map.setMaxBounds(californiaBounds);
map.fitBounds(californiaBounds);
map.setMinZoom(5);
map.options.maxBoundsViscosity = 1.0; // smooth resistance at edges instead of a hard snap

const imagery = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
        maxZoom: 20
    }
);

const labels = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    {
        attribution: "Labels © Esri",
        maxZoom: 20
    }
);

// --- Fire risk layer (USDA Forest Service - Burn Probability, live IIPP service) ---
const fireRisk = L.esri.imageMapLayer({
    url: "https://imagery.geoplatform.gov/iipp/rest/services/Fire_Aviation/USFS_EDW_RMRS_WRC_BurnProbability/ImageServer",
    opacity: 0.6,
    attribution: "USDA Forest Service, Rocky Mountain Research Station"
});

imagery.addTo(map);
labels.addTo(map);

let fireRiskAdded = false;

// FIX: the map now lives inside the "Plan My Route" accordion (#collapseRoute),
// not inside "Predict Maintenance Need" (#collapsePredict) anymore.
// Leaflet needs invalidateSize() called once the container becomes visible,
// otherwise the map renders with 0 height/width (blank) and never shows tiles or routes.
document.getElementById("collapseRoute").addEventListener("shown.bs.collapse", () => {
    setTimeout(() => {
        map.invalidateSize();
        if (routeLayer) {
            map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
        }
        if (fireRiskAdded) {
            fireRisk.redraw();
        }
        // fire layer is only added when the toggle is switched on, not automatically here
    }, 200);
});

document.getElementById("fireRiskToggle").addEventListener("change", (e) => {
    if (e.target.checked) {
        fireRisk.addTo(map);
        fireRiskAdded = true;
    } else {
        map.removeLayer(fireRisk);
    }
});

// --- Asset markers on the map, keyed by assetId ---
// Keyed by assetId so re-running a prediction or re-planning a route
// updates the same marker instead of stacking duplicates on top of it.
const assetMarkers = {};

function createPinIcon(bgColor, label) {
    return L.divIcon({
        className: "",
        html: `<div style="
            background:${bgColor};
            width:30px; height:30px;
            border-radius:50% 50% 50% 0;
            transform: rotate(45deg);
            display:flex; align-items:center; justify-content:center;
            border:2px solid white;
            box-shadow:0 1px 4px rgba(0,0,0,0.4);
        "><span style="transform: rotate(-45deg); color:#fff; font-weight:700; font-size:13px;">${label}</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -28]
    });
}

function addMarker(lat, lng, assetId, needsMaintenance) {
    const color = needsMaintenance ? "#dc3545" : "#198754";
    const icon = createPinIcon(color, needsMaintenance ? "!" : "✓");

    if (assetMarkers[assetId]) {
        map.removeLayer(assetMarkers[assetId]);
    }

    const marker = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(`<strong>${assetId}</strong><br>${needsMaintenance ? "Needs Maintenance" : "OK"}`)
        .openPopup();

    assetMarkers[assetId] = marker;
    return marker;
}

// Turns an existing asset marker into a numbered "stop" pin once it's part of a planned route.
function markAsStop(assetId, stopNumber, priorityLevel) {
    const marker = assetMarkers[assetId];
    if (!marker) return;

    const priorityBg = {
        Critical: "#dc3545",
        High: "#fd7e14",
        Medium: "#0dcaf0",
        Low: "#198754"
    };
    const bg = priorityBg[priorityLevel] || "#6c757d";

    marker.setIcon(createPinIcon(bg, String(stopNumber)));
    marker.setPopupContent(`<strong>Stop ${stopNumber}: ${assetId}</strong><br>Priority: ${priorityLevel || "-"}`);
}

// --- Asset log (single source of truth for the table + routing) ---
let assetLog = [];
let nextRowId = 1;

function logAssetForRouting(payload, data) {
    const existing = assetLog.find(a => a.assetId === payload.assetId);

    if (existing) {
        existing.assetType = payload.assetType;
        existing.lat = payload.latitude;
        existing.lon = payload.longitude;
        existing.priorityScore = data.priorityScore;
        existing.priorityLevel = data.priorityLevel;
        existing.needsMaintenance = data.needsMaintenance;
        existing.fireDangerRating = data.fireDangerRating;
    } else {
        assetLog.push({
            id: "row-" + nextRowId++,
            assetId: payload.assetId,
            assetType: payload.assetType,
            lat: payload.latitude,
            lon: payload.longitude,
            priorityScore: data.priorityScore,
            priorityLevel: data.priorityLevel,
            needsMaintenance: data.needsMaintenance,
            fireDangerRating: data.fireDangerRating,
            selected: true
        });
    }

    renderAssetsTable();
}

function renderAssetsTable() {
    const tbody = document.getElementById("assetsTableBody");
    const noAssetsMsg = document.getElementById("noAssetsMsg");
    if (!tbody) return; // table only exists once the Route section markup is present

    tbody.innerHTML = "";
    noAssetsMsg.classList.toggle("d-none", assetLog.length > 0);

    const priorityColors = { Critical: "danger", High: "warning", Medium: "info", Low: "success" };
    const fireColors = { Extreme: "danger", High: "warning", Moderate: "info", Low: "success" };

    assetLog.forEach(asset => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><input type="checkbox" class="form-check-input asset-checkbox" data-id="${asset.id}" ${asset.selected ? "checked" : ""}></td>
            <td>${asset.assetId}</td>
            <td>${asset.assetType || "-"}</td>
            <td><span class="badge bg-${priorityColors[asset.priorityLevel] || "secondary"}">${asset.priorityLevel} (${asset.priorityScore.toFixed(0)})</span></td>
            <td>${asset.needsMaintenance ? "⚠️ Yes" : "OK"}</td>
            <td><span class="badge bg-${fireColors[asset.fireDangerRating] || "secondary"}">${asset.fireDangerRating || "-"}</span></td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll(".asset-checkbox").forEach(cb => {
        cb.addEventListener("change", (e) => {
            const asset = assetLog.find(a => a.id === e.target.getAttribute("data-id"));
            if (asset) asset.selected = e.target.checked;
        });
    });
}

const selectAllCheckbox = document.getElementById("selectAllAssets");
if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", (e) => {
        assetLog.forEach(a => a.selected = e.target.checked);
        renderAssetsTable();
    });
}

// --- Mode switching (Automatic = all assets by priority, Manual = checked assets only) ---
const modeAuto = document.getElementById("modeAuto");
const modeManual = document.getElementById("modeManual");
const manualSelectPanel = document.getElementById("manualSelectPanel");

if (modeAuto && modeManual && manualSelectPanel) {
    modeAuto.addEventListener("change", () => {
        manualSelectPanel.classList.add("d-none");
    });
    modeManual.addEventListener("change", () => {
        manualSelectPanel.classList.remove("d-none");
        renderAssetsTable();
    });
}

// --- Route planning ---
let routeLayer = null;
let userLocationMarker = null;

function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser."));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                });
            },
            (error) => {
                reject(new Error("Could not get your location: " + error.message));
            }
        );
    });
}

function formatManeuver(maneuver, streetName) {
    const type = maneuver.type;
    const modifier = maneuver.modifier;

    switch (type) {
        case "depart":
            return `Head out onto <strong>${streetName}</strong>`;
        case "arrive":
            return `Arrive at destination`;
        case "turn":
            return `Turn ${modifier} onto <strong>${streetName}</strong>`;
        case "continue":
            return `Continue on <strong>${streetName}</strong>`;
        case "merge":
            return `Merge onto <strong>${streetName}</strong>`;
        case "on ramp":
            return `Take the ramp onto <strong>${streetName}</strong>`;
        case "off ramp":
            return `Take the exit onto <strong>${streetName}</strong>`;
        case "fork":
            return `Keep ${modifier} at the fork onto <strong>${streetName}</strong>`;
        case "roundabout":
            return `Enter the roundabout, take exit onto <strong>${streetName}</strong>`;
        default:
            return streetName ? `Continue onto <strong>${streetName}</strong>` : null;
    }
}

async function planPriorityRoute() {
    const summaryDiv = document.getElementById("routeSummary");
    const isManual = modeManual && modeManual.checked;

    const chosenAssets = isManual
        ? assetLog.filter(a => a.selected)
        : assetLog;

    if (chosenAssets.length < 1) {
        summaryDiv.classList.remove("d-none");
        summaryDiv.textContent = isManual
            ? "Select at least 1 asset from the table."
            : "Need at least 1 predicted asset to plan a route. Run a prediction first.";
        return;
    }

    summaryDiv.classList.remove("d-none");
    summaryDiv.textContent = "Getting your location...";

    let userLocation;
    try {
        userLocation = await getUserLocation();
    } catch (err) {
        summaryDiv.textContent = err.message;
        return;
    }

    // Show a marker for the user's current location
    if (userLocationMarker) map.removeLayer(userLocationMarker);
    userLocationMarker = L.marker([userLocation.lat, userLocation.lon], {
        icon: L.divIcon({
            className: "",
            html: '<div style="background:#0d6efd;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>',
            iconSize: [16, 16]
        })
    }).addTo(map).bindPopup("Your current location").openPopup();

    // Sort chosen assets by priority, highest first
    const sortedAssets = [...chosenAssets].sort((a, b) => b.priorityScore - a.priorityScore);

    // Update each asset's map pin to show its stop number in route order
    sortedAssets.forEach((asset, idx) => {
        markAsStop(asset.assetId, idx + 1, asset.priorityLevel);
    });

    // Build stop list: your location FIRST, then assets in priority order
    const allStops = [
        { lat: userLocation.lat, lon: userLocation.lon, assetId: "Your Location", priorityLevel: "" },
        ...sortedAssets
    ];

    const coordsParam = allStops.map(a => `${a.lon},${a.lat}`).join(";");

    summaryDiv.textContent = "Calculating route...";

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&steps=true`;

        const res = await fetch(url);
        const result = await res.json();

        if (result.code !== "Ok") {
            summaryDiv.textContent = "Routing error: " + result.message;
            return;
        }

        const route = result.routes[0];
        const totalMinutes = route.duration / 60;
        const totalMiles = route.distance / 1609.34;

        if (routeLayer) map.removeLayer(routeLayer);

        const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
        routeLayer = L.polyline(coords, { color: "#0d6efd", weight: 5, opacity: 0.8 }).addTo(map);

        // Make sure the map has its real size before fitting bounds
        map.invalidateSize();
        map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });

        const orderList = allStops.map((a, i) =>
            i === 0 ? "📍 You" : `${i}. ${a.assetId} (${a.priorityLevel})`
        ).join(" → ");

        summaryDiv.innerHTML = `
            <strong>Route planned:</strong> ${totalMiles.toFixed(1)} mi, ~${Math.round(totalMinutes)} min<br>
            <strong>Order:</strong> ${orderList}
        `;

        // Build turn-by-turn directions with street names
        const directionsDiv = document.getElementById("turnByTurnDirections");
        directionsDiv.classList.remove("d-none");

        let stepsHtml = `<div class="card"><div class="card-body">
            <h6 class="card-title"><i class="bi bi-signpost-split-fill me-2"></i>Turn-by-Turn Directions</h6>
            <ol class="mb-0" style="max-height: 300px; overflow-y: auto;">`;

        route.legs.forEach((leg) => {
            leg.steps.forEach(step => {
                const streetName = step.name || "Unnamed road";
                const maneuver = formatManeuver(step.maneuver, streetName);
                const distanceMi = (step.distance / 1609.34).toFixed(2);

                if (maneuver) {
                    stepsHtml += `<li class="mb-1">${maneuver} <span class="text-muted">(${distanceMi} mi)</span></li>`;
                }
            });
        });

        stepsHtml += `</ol></div></div>`;
        directionsDiv.innerHTML = stepsHtml;

    } catch (err) {
        summaryDiv.textContent = "Error planning route: " + err.message;
    }
}

document.getElementById("createRoutePlanBtn").addEventListener("click", planPriorityRoute);
