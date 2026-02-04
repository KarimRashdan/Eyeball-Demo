let settingsButtonElement = null;
let settingsOverlayElement = null;

let currentSettings = {
    mode: "mode1",
    model: "modelA",

    modelScale: 1.0,
    webcamScale: 1.0,
    rotationAggressiveness: 1.0,
};

let draftSettings = { ...currentSettings };

export function getCurrentSettings() {
    return { ...currentSettings };
}

export function getModelScale() {
    const v = Number(currentSettings.modelScale);
    return Number.isFinite(v) ? v : 1.0;
}

export function getWebcamScale() {
    const v = Number(currentSettings.webcamScale);
    return Number.isFinite(v) ? v : 1.0;
}

export function getRotationAggressiveness() {
    const v = Number(currentSettings.rotationAggressiveness);
    return Number.isFinite(v) ? v : 1.0;
}

function applyAdminSettings() {
    document.documentElement.style.setProperty('--webcam-scale', String(getWebcamScale()));
}

function openSettings() {
    if (!settingsOverlayElement) return;
    settingsOverlayElement.style.display = "flex";
    syncSettingsUI();
}

function closeSettings() {
    if (!settingsOverlayElement) return;
    settingsOverlayElement.style.display = "none";
}

function syncSettingsUI() {
    if (!settingsOverlayElement) return;

    const modeInputs = settingsOverlayElement.querySelectorAll('input[name="setting-mode"]');
    modeInputs.forEach((el) => (el.checked = (el.value === draftSettings.mode)));

    const modelInputs = settingsOverlayElement.querySelectorAll('input[name="setting-model"]');
    modelInputs.forEach((el) => (el.checked = (el.value === draftSettings.model)));

    const modelScaleInput = settingsOverlayElement.querySelector("#setting-admin-model-scale");
    const webcamScaleInput = settingsOverlayElement.querySelector("#setting-admin-webcam-scale");
    const rotationAggressivenessInput = settingsOverlayElement.querySelector("#setting-admin-rotation-aggressiveness");

    if (modelScaleInput) modelScaleInput.value = String(draftSettings.modelScale ?? 1.0);
    if (webcamScaleInput) webcamScaleInput.value = String(draftSettings.webcamScale ?? 1.0);
    if (rotationAggressivenessInput) rotationAggressivenessInput.value = String(draftSettings.rotationAggressiveness ?? 1.0);

    const modelScaleValue = settingsOverlayElement.querySelector("#setting-admin-model-scale-value");
    const webcamScaleValue = settingsOverlayElement.querySelector("#setting-admin-webcam-scale-value");
    const rotationAggressivenessValue = settingsOverlayElement.querySelector("#setting-admin-rotation-aggressiveness-value");

    if (modelScaleValue) modelScaleValue.textContent = Number(draftSettings.modelScale ?? 1.0).toFixed(2);
    if (webcamScaleValue) webcamScaleValue.textContent = Number(draftSettings.webcamScale ?? 1.0).toFixed(2);
    if (rotationAggressivenessValue) rotationAggressivenessValue.textContent = Number(draftSettings.rotationAggressiveness ?? 1.0).toFixed(2);

    updateMode1Visibility();
}

function updateMode1Visibility() {
    if (!settingsOverlayElement) return;
    const mode1Block = settingsOverlayElement.querySelector("#setting-mode1-suboptions");
    if (!mode1Block) return;

    const isMode1 = (draftSettings.mode === "mode1");
    mode1Block.style.display = isMode1 ? "block" : "none";

    if (!isMode1) {
        const modelInputs = settingsOverlayElement.querySelectorAll('input[name="setting-model"]');
        modelInputs.forEach((el) => (el.checked = false));
    }
}

export function initSettingsUI() {
    settingsButtonElement = document.createElement("button");
    settingsButtonElement.id = "settings-button";
    settingsButtonElement.type = "button";
    settingsButtonElement.title = "Settings";
    settingsButtonElement.innerHTML = "⚙️";

    settingsButtonElement.addEventListener("click", () => {
        if (!settingsOverlayElement) return;
        const isOpen = settingsOverlayElement.style.display === "flex";
        if (isOpen) closeSettings();
        else openSettings();
    });

    document.body.appendChild(settingsButtonElement);
    settingsOverlayElement = document.createElement("div");
    settingsOverlayElement.id = "settings-overlay";

    const panel = document.createElement("div");
    panel.id = "settings-panel";
    panel.innerHTML = `
        <div class="settings-title">User Settings</div>
        <div class="settings-section">
            <h3>Mode selection</h3>
            <label class="settings-option">
                <input type="radio" name="setting-mode" value="mode1">
                <div>Mode 1 <span style="opacity:0.7">(manual model select)</span></div>
            </label>

            <div id="setting-mode1-suboptions" class="settings-suboptions">
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelA">
                    <div>Model A</div>
                </label>
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelB">
                    <div>Model B</div>
                </label>
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelC">
                    <div>Model C</div>
                </label>
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelD">
                    <div>Model D</div>
                </label>
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelE">
                    <div>Model E</div>
                </label>
            </div>

            <label class="settings-option">
                <input type="radio" name="setting-mode" value="mode2">
                <div>Mode 2</div>
            </label>

            <label class="settings-option">
                <input type="radio" name="setting-mode" value="mode3">
                <div>Mode 3</div>
            </label>
        </div>

        <div class="settings-section">
            <h3>Admin settings</h3>

            <div class="settings-slider">
                <div class="settings-slider-row">
                    <div>Model scale</div>
                    <div class="settings-slider-value" id="setting-admin-model-scale-value">1.00</div>
                </div>
                <input id="setting-admin-model-scale" type="range" min="0.50" max="2.00" step="0.01" value="1.00" />
            </div>

            <div class="settings-slider">
                <div class="settings-slider-row">
                    <div>Webcam feed scale</div>
                    <div class="settings-slider-value" id="setting-admin-webcam-scale-value">1.00</div>
                </div>
                <input id="setting-admin-webcam-scale" type="range" min="0.50" max="2.00" step="0.01" value="1.00" />
            </div>

            <div class="settings-slider">
                <div class="settings-slider-row">
                    <div>Rotation aggressiveness</div>
                    <div class="settings-slider-value" id="setting-admin-rotation-aggressiveness-value">1.00</div>
                </div>
                <input id="setting-admin-rotation-aggressiveness" type="range" min="0.25" max="2.50" step="0.01" value="1.00" />
            </div>
        </div>

        <div class="settings-actions">
            <button class="settings-btn" id="settings-cancel" type="button">Cancel</button>
            <button class="settings-btn settings-btn-primary" id="settings-apply" type="button">Apply</button>
        </div>
    `;

    settingsOverlayElement.appendChild(panel);
    document.body.appendChild(settingsOverlayElement);

    settingsOverlayElement.addEventListener("click", (e) => {
        if (e.target === settingsOverlayElement) closeSettings();
    });

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeSettings();
    });

    settingsOverlayElement.querySelectorAll('input[name="setting-mode"]').forEach((el) => {
        el.addEventListener("change", () => {
            draftSettings.mode = el.value;

            if (draftSettings.mode !== "mode1") {
                draftSettings.model = null;
            }

            updateMode1Visibility();
            syncSettingsUI();
        });
    });

    settingsOverlayElement.querySelectorAll('input[name="setting-model"]').forEach((el) => {
        el.addEventListener("change", () => {
            draftSettings.model = el.value;
        });
    });

    const cancelBtn = settingsOverlayElement.querySelector("#settings-cancel");
    cancelBtn.addEventListener("click", () => {
        draftSettings = { ...currentSettings };
        closeSettings();
    });

    const modelScaleElement = settingsOverlayElement.querySelector("#setting-admin-model-scale");
    const webcamScaleElement = settingsOverlayElement.querySelector("#setting-admin-webcam-scale");
    const rotationAggressivenessElement = settingsOverlayElement.querySelector("#setting-admin-rotation-aggressiveness");

    if (modelScaleElement) {
        modelScaleElement.addEventListener("input", () => {
            draftSettings.modelScale = Number(modelScaleElement.value);
            syncSettingsUI();
        });
    }

    if (webcamScaleElement) {
        webcamScaleElement.addEventListener("input", () => {
            draftSettings.webcamScale = Number(webcamScaleElement.value);
            syncSettingsUI();
        });
    }

    if (rotationAggressivenessElement) {
        rotationAggressivenessElement.addEventListener("input", () => {
            draftSettings.rotationAggressiveness = Number(rotationAggressivenessElement.value);
            syncSettingsUI();
        });
    }

    const applyBtn = settingsOverlayElement.querySelector("#settings-apply");
    applyBtn.addEventListener("click", () => {
        currentSettings = { ...draftSettings };
        applyAdminSettings();
        closeSettings();
    });

    applyAdminSettings();
    syncSettingsUI();
}