const API_BASE = ""; // same origin, leave empty; or set full Render URL if UI is hosted separately

// --- Predict form ---
document.getElementById("predictForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        assetId: document.getElementById("assetId").value,
        assetType: document.getElementById("assetType").value,
        latitude: parseFloat(document.getElementById("latitude").value),
        longitude: parseFloat(document.getElementById("longitude").value),
        ageYears: parseFloat(document.getElementById("ageYears").value),
        lastInspectionMonthsAgo: parseFloat(document.getElementById("lastInspection").value)
    };

    const resultDiv = document.getElementById("predictResult");
    resultDiv.classList.remove("d-none");
    resultDiv.textContent = "Predicting...";

    try {
        const res = await fetch(`${API_BASE}/api/prediction/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        const maintenanceColor = data.needsMaintenance ? "danger" : "success";
        const maintenanceIcon = data.needsMaintenance ? "bi-exclamation-triangle-fill" : "bi-check-circle-fill";

        const fireColors = {
            "Extreme": "danger",
            "High": "warning",
            "Moderate": "info",
            "Low": "success"
        };
        const fireColor = fireColors[data.fireDangerRating] || "secondary";

        const priorityColors = {
            "Critical": "danger",
            "High": "warning",
            "Medium": "info",
            "Low": "success"
        };
        const priorityColor = priorityColors[data.priorityLevel] || "secondary";

        resultDiv.innerHTML = `
            <div class="d-flex align-items-center gap-2 mb-2">
                <i class="bi bi-flag-fill text-${priorityColor} fs-5"></i>
                <span class="fw-semibold">Priority:</span>
                <span class="badge bg-${priorityColor}">${data.priorityLevel} (${data.priorityScore.toFixed(0)}/100)</span>
            </div>

            <div class="d-flex align-items-center gap-2 mb-2">
                <i class="bi ${maintenanceIcon} text-${maintenanceColor} fs-5"></i>
                <span class="fw-semibold">Needs Maintenance:</span>
                <span class="badge bg-${maintenanceColor}">${data.needsMaintenance ? "Yes" : "No"} (${(data.probability * 100).toFixed(1)}%)</span>
            </div>

            <div class="d-flex flex-wrap gap-3 text-muted mb-2 pt-2 border-top">
                <span><i class="bi bi-thermometer-half text-danger me-1"></i>${data.temperatureC.toFixed(1)}°C</span>
                <span><i class="bi bi-wind text-primary me-1"></i>${data.windSpeedKph.toFixed(1)} km/h</span>
                <span><i class="bi bi-cloud-rain text-info me-1"></i>${data.precipitationMm.toFixed(1)} mm</span>
            </div>

            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-fire text-${fireColor} fs-5"></i>
                <span class="fw-semibold">Fire Risk:</span>
                <span class="badge bg-${fireColor}">${data.fireDangerRating} (FWI: ${data.fireWeatherIndex.toFixed(1)})</span>
            </div>
        `;

        addMarker(payload.latitude, payload.longitude, payload.assetId, data.needsMaintenance);
        logAssetForRouting(payload, data);
    } catch (err) {
        resultDiv.textContent = "Error: " + err.message;
    }
});

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

imagery.addTo(map);
labels.addTo(map);

// Fix Leaflet map when accordion opens
document.getElementById("collapsePredict").addEventListener("shown.bs.collapse", () => {
    setTimeout(() => {
        map.invalidateSize();
    }, 200);
});

function addMarker(lat, lng, label, needsMaintenance) {
    const color = needsMaintenance ? "red" : "green";
    L.circleMarker([lat, lng], { radius: 8, color }).addTo(map)
        .bindPopup(`${label} — ${needsMaintenance ? "Needs Maintenance" : "OK"}`)
        .openPopup();
}

// --- Route planning (priority order) ---
const assetLog = [];

function logAssetForRouting(payload, data) {
    assetLog.push({
        assetId: payload.assetId,
        lat: payload.latitude,
        lon: payload.longitude,
        priorityScore: data.priorityScore,
        priorityLevel: data.priorityLevel
    });
}


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

    if (assetLog.length < 1) {
        summaryDiv.classList.remove("d-none");
        summaryDiv.textContent = "Need at least 1 predicted asset to plan a route. Run a prediction first.";
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

    // Sort predicted assets by priority, highest first
    const sortedAssets = [...assetLog].sort((a, b) => b.priorityScore - a.priorityScore);

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

                route.legs.forEach((leg, legIndex) => {
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

document.getElementById("planRouteBtn").addEventListener("click", planPriorityRoute);

function logAssetForRouting(payload, data) {
    assetLog.push({
        assetId: payload.assetId,
        lat: payload.latitude,
        lon: payload.longitude,
        priorityScore: data.priorityScore,
        priorityLevel: data.priorityLevel
    });
}

// ⬇️ paste the planPriorityRoute function and event listener from above here