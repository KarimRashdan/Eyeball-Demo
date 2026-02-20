let settingsButtonElement = null;
let settingsOverlayElement = null;

let currentSettings = {
    mode: "mode1",
    model: "modelA",

    modelScale: 1.9,
    webcamScale: 2.3,
    rotationAggressiveness: 1.0,

    background: "bg-none",
};

const launchDefaults = { ...currentSettings };

let draftSettings = { ...currentSettings };

const MODE1_MODEL_TO_KEY = {
    modelA: "neutral",
    modelB: "happy",
    modelC: "sad",
    modelD: "angry",
    modelE: "surprised",
};

const SETTINGS_CHANGED_EVENT = "app-settings-changed";

export function getCurrentSettings() {
    return { ...currentSettings };
}

export function getMode() {
    return currentSettings.mode;
}

export function getMode1ModelKey() {
    const model = currentSettings.model || "modelA";
    return MODE1_MODEL_TO_KEY[model] ?? "neutral";
}

const BACKGROUND_OPTIONS = {
    "bg-none": { label: "None", cssValue: "none" },
    "bg-1": { label: "Background 1", cssValue: "url('./assets/bg1.jpg')" },
    "bg-2": { label: "Background 2", cssValue: "url('./assets/bg2.jpg')" },
    "bg-3": { label: "Background 3", cssValue: "url('./assets/bg3.jpg')" },
    "bg-4": { label: "Background 4", cssValue: "url('./assets/bg4.jpg')" },
    "bg-5": { label: "Background 5", cssValue: "url('./assets/bg5.jpg')" },
};

function applyBackgroundSetting() {
    const key = currentSettings.background;
    const option = BACKGROUND_OPTIONS[key];
    document.documentElement.style.setProperty("--bg-image", option?.cssValue ?? "none");
}

export function revertToDefaults() {
    Object.assign(currentSettings, launchDefaults);
    forceApplySettings(currentSettings);
    const rotationSlider = document.getElementById("rotation-slider");
    const modelScaleSlider = document.getElementById("scale-slider");
    const webcamScaleSlider = document.getElementById("webcam-scale-slider");
    if (rotationSlider) rotationSlider.value = launchDefaults.rotationAggressiveness;
    if (modelScaleSlider) modelScaleSlider.value = launchDefaults.modelScale;
    if (webcamScaleSlider) webcamScaleSlider.value = launchDefaults.webcamScale;
}

export function onSettingsChanged(handler) {
    if (typeof handler !== "function") return () => {};
    const wrapped = (e) => handler(e?.detail ?? getCurrentSettings());
    window.addEventListener(SETTINGS_CHANGED_EVENT, wrapped);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, wrapped);
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
    applyBackgroundSetting();
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

    const backgroundSelect = settingsOverlayElement.querySelector("#setting-background");
    if (backgroundSelect) backgroundSelect.value = draftSettings.background || "bg-none";

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
    settingsButtonElement.innerHTML = "CLICK ME!";

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
                <div>Manual <span style="opacity:0.7">(choose your model)</span></div>
            </label>

            <div id="setting-mode1-suboptions" class="settings-suboptions">
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelA">
                    <div>Normal Eye</div>
                </label>
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelB">
                    <div>Duck Norris</div>
                </label>
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelC">
                    <div>Illusory Eye</div>
                </label>
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelD">
                    <div>Eye of Sauron</div>
                </label>
                <label class="settings-option">
                    <input type="radio" name="setting-model" value="modelE">
                    <div>Bill Cipher</div>
                </label>
            </div>

            <label class="settings-option">
                <input type="radio" name="setting-mode" value="mode2">
                <div>Shuffle Cycle</div>
            </label>

            <label class="settings-option">
                <input type="radio" name="setting-mode" value="mode3">
                <div>Expression Detection</div>
            </label>
        </div>

        <div class="settings-section">
            <h3>Background</h3>
            <div class="settings-option" style="justify-content: space-between;">
                <div>Choose background</div>
                <select id="setting-background" class="settings-btn">
                    <option value="bg-none">Default</option>
                    <option value="bg-1">Lecture Hall CB1.10</option>
                    <option value="bg-2">Super Mario 64</option>
                    <option value="bg-3">Iron Throne</option>
                    <option value="bg-4">Silly</option>
                    <option value="bg-5">Cheeky Nando's</option>
                </select>
            </div>
        </div>                

        <div class="settings-section">
            <h3>Admin settings</h3>

            <div class="settings-slider">
                <div class="settings-slider-row">
                    <div>Model scale</div>
                    <div class="settings-slider-value" id="setting-admin-model-scale-value">1.90</div>
                </div>
                <input id="setting-admin-model-scale" type="range" min="0.30" max="2.80" step="0.01" value="1.90" />
            </div>

            <div class="settings-slider">
                <div class="settings-slider-row">
                    <div>Webcam feed scale</div>
                    <div class="settings-slider-value" id="setting-admin-webcam-scale-value">2.30</div>
                </div>
                <input id="setting-admin-webcam-scale" type="range" min="0.00" max="4.00" step="0.01" value="2.30" />
            </div>

            <div class="settings-slider">
                <div class="settings-slider-row">
                    <div>Rotation sensitivity</div>
                    <div class="settings-slider-value" id="setting-admin-rotation-aggressiveness-value">1.00</div>
                </div>
                <input id="setting-admin-rotation-aggressiveness" type="range" min="0.25" max="2.50" step="0.01" value="1.00" />
            </div>
        </div>

        <div class="settings-actions">
            <button class="settings-btn" id="settings-defaults" type="button">Revert to Defaults</button>
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

    const resetBtn = settingsOverlayElement.querySelector("#settings-defaults");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            revertToDefaults();
            syncSettingsUI();
        });
    }

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
        draftSettings = { ...currentSettings };
        applyAdminSettings();
        closeSettings();
        window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: getCurrentSettings() }));
    });

    const backgroundSelect = settingsOverlayElement.querySelector("#setting-background");
    if (backgroundSelect) {
        backgroundSelect.addEventListener("change", () => {
            draftSettings.background = backgroundSelect.value;
            syncSettingsUI();
        });
    }

    applyAdminSettings();
    syncSettingsUI();
}

export function forceApplySettings(partial) {
    currentSettings = { ...currentSettings, ...partial };
    draftSettings = { ...currentSettings };
    applyAdminSettings();
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: getCurrentSettings() }));
}