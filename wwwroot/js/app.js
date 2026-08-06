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
    const file = fileInput.files[0];
    const expectedType = document.getElementById("expectedAssetType").value;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("expectedAssetType", expectedType);

    const resultDiv = document.getElementById("imageResult");
    const listDiv = document.getElementById("detectionsList");
    resultDiv.classList.remove("d-none");
    resultDiv.textContent = "Classifying...";
    listDiv.innerHTML = "";

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
            canvas.classList.remove("d-none"); // ✅ show it now that we have a result
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
            document.getElementById("imageResultPopup").textContent = "No findings detected in this photo.";
            document.getElementById("detectionsPopup").innerHTML = "";

            const modal = new bootstrap.Modal(document.getElementById("imageResultModal"));
            modal.show();
            return;
        }
        let html = "<ul>";
        data.detections.forEach(det => {
            html += `<li>${det.label} — ${det.confidence.toFixed(2)}%</li>`;
        });
        html += "</ul>";

        document.getElementById("imageResultPopup").textContent = "Asset Discrepancy:";
        document.getElementById("detectionsPopup").innerHTML = html;

        const modal = new bootstrap.Modal(document.getElementById("imageResultModal"));
        modal.show();


        resultDiv.textContent = `Found ${data.detectionCount} Findings detected:`;
        listDiv.innerHTML = data.detections.map(d => `
            <div class="d-flex justify-content-between align-items-center border rounded px-3 py-2 mb-2">
                <span class="fw-semibold text-capitalize">${d.class}</span>
                <span class="badge bg-primary">${(d.confidence * 100).toFixed(1)}%</span>
            </div>
        `).join("");

    } catch (err) {
        resultDiv.textContent = "Error: " + err.message;
    }
});

// 1. Inicializa el mapa primero
const map = L.map("map").setView([37.9101, -122.0652], 13);

// 2. Esri World Imagery
const imagery = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
        maxZoom: 20
    }
);

// 3. Esri Hybrid Labels
const labels = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    {
        attribution: "Labels © Esri",
        maxZoom: 20
    }
);

// 4. Agrega ambas capas al mapa
imagery.addTo(map);
labels.addTo(map);

function addMarker(lat, lng, label, needsMaintenance) {
    const color = needsMaintenance ? "red" : "green";
    L.circleMarker([lat, lng], { radius: 8, color }).addTo(map)
        .bindPopup(`${label} — ${needsMaintenance ? "Needs Maintenance" : "OK"}`)
        .openPopup();
}