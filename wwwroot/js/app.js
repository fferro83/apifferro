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
        resultDiv.textContent = `Needs Maintenance: ${data.needsMaintenance} | Probability: ${(data.probability * 100).toFixed(1)}%`;

        addMarker(payload.latitude, payload.longitude, payload.assetId, data.needsMaintenance);
    } catch (err) {
        resultDiv.textContent = "Error: " + err.message;
    }
});

// --- Image form ---
document.getElementById("imageForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("imageFile");
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    const resultDiv = document.getElementById("imageResult");
    resultDiv.textContent = "Classifying...";

    try {
        const res = await fetch(`${API_BASE}/api/image/predict`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        resultDiv.textContent = `Label: ${data.label} | Confidence: ${(data.confidence * 100).toFixed(1)}%`;
    } catch (err) {
        resultDiv.textContent = "Error: " + err.message;
    }
});

// --- Map setup ---
const map = L.map("map").setView([37.9101, -122.0652], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

function addMarker(lat, lng, label, needsMaintenance) {
    const color = needsMaintenance ? "red" : "green";
    L.circleMarker([lat, lng], { radius: 8, color }).addTo(map)
        .bindPopup(`${label} — ${needsMaintenance ? "Needs Maintenance" : "OK"}`)
        .openPopup();
}